import { dialog } from 'electron';
import { readFile } from 'fs/promises';
import * as path from 'path';
import mammoth from 'mammoth';
import { ResumeImportResult } from '../shared/types';
import { parseResumeText } from './parseResumeText';

interface PdfTextItem {
  str: string;
  hasEOL: boolean;
  /** [scaleX, skewX, skewY, scaleY, x, y] in PDF points. */
  transform: number[];
  width: number;
}
interface PdfPage {
  getTextContent(): Promise<{ items: Array<PdfTextItem | { type: string }> }>;
}
interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

// The legacy build runs in Node without a real worker. Its fallback tries to
// dynamically import pdf.worker.mjs at runtime, which webpack does not emit —
// so bundle the worker here and hand it over via the globalThis hook pdf.js
// checks before attempting that import.
// eslint-disable-next-line @typescript-eslint/no-var-requires
(globalThis as Record<string, unknown>).pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.mjs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs') as {
  getDocument(params: {
    data: Uint8Array;
    verbosity?: number;
  }): { promise: Promise<PdfDocument>; destroy(): Promise<void> };
};

/**
 * Reassembles pdf.js text items into lines. Items on the same baseline are
 * separate runs with no whitespace between them, so the horizontal gap decides
 * the separator: a small gap is a word space, a wide one (table cell, right-
 * aligned date) becomes a double space the parser treats as a column break.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const { items } = await (await doc.getPage(i)).getTextContent();
      let text = '';
      let lastY: number | null = null;
      let lastRight: number | null = null;
      for (const item of items) {
        if (!('str' in item)) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        const fontSize = Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 10;
        if (lastY !== null && Math.abs(y - lastY) > 1) {
          text += '\n';
          lastRight = null;
        }
        if (item.str) {
          if (lastRight !== null && !/\s$/.test(text) && !/^\s/.test(item.str)) {
            const gap = x - lastRight;
            if (gap > fontSize * 1.5) text += '  ';
            else if (gap > fontSize * 0.12) text += ' ';
          }
          text += item.str;
          lastRight = x + (item.width ?? 0);
        }
        if (item.hasEOL) {
          text += '\n';
          lastY = null;
          lastRight = null;
        } else {
          lastY = y;
        }
      }
      pages.push(text);
    }
    return pages.join('\n');
  } finally {
    await task.destroy();
  }
}

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    return extractPdfText(await readFile(filePath));
  }
  if (ext === '.docx') {
    return (await mammoth.extractRawText({ path: filePath })).value;
  }
  return readFile(filePath, 'utf8');
}

const RESUME_FILE_FILTERS = [
  { name: 'Resumes (PDF, Word, text)', extensions: ['pdf', 'docx', 'txt', 'md'] },
  { name: 'All Files', extensions: ['*'] },
];

/** Prompts for a resume file and returns its name; null when the user cancels. */
export async function pickResumeFile(): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Upload Resume',
    properties: ['openFile'],
    filters: RESUME_FILE_FILTERS,
  });
  if (canceled || filePaths.length === 0) return null;
  return path.basename(filePaths[0]);
}

/** Prompts for a resume file and parses it; null when the user cancels. */
export async function importResumeFromFile(): Promise<ResumeImportResult | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Resume',
    properties: ['openFile'],
    filters: RESUME_FILE_FILTERS,
  });
  if (canceled || filePaths.length === 0) return null;

  const filePath = filePaths[0];
  const fileName = path.basename(filePath);
  const text = await extractText(filePath);
  if (!text.trim()) {
    throw new Error(
      `No text could be extracted from ${fileName}. If it is a scanned PDF, export a text-based copy and try again.`
    );
  }

  const { resume, warnings } = parseResumeText(text);
  return { fileName, resume, warnings };
}
