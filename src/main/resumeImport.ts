import { dialog } from 'electron';
import { readFile } from 'fs/promises';
import * as path from 'path';
import mammoth from 'mammoth';
import { ResumeImportResult } from '../shared/types';
import { parseResumeText } from './parseResumeText';

interface PdfTextItem {
  str: string;
  hasEOL: boolean;
  transform: number[];
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

/** Reassembles pdf.js text items into lines using their y positions. */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const { items } = await (await doc.getPage(i)).getTextContent();
      let text = '';
      let lastY: number | null = null;
      for (const item of items) {
        if (!('str' in item)) continue;
        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 1) text += '\n';
        text += item.str;
        if (item.hasEOL) {
          text += '\n';
          lastY = null;
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

/** Prompts for a resume file and parses it; null when the user cancels. */
export async function importResumeFromFile(): Promise<ResumeImportResult | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Resume',
    properties: ['openFile'],
    filters: [
      { name: 'Resumes (PDF, Word, text)', extensions: ['pdf', 'docx', 'txt', 'md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
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
