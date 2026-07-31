import { randomUUID } from 'crypto';
import {
  DEFAULT_RESUME,
  Resume,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
  ResumeSkill,
} from '../shared/types';

type SectionKey = 'summary' | 'skills' | 'experience' | 'education' | 'projects';

const SECTION_HEADERS: Array<{ key: SectionKey; re: RegExp }> = [
  {
    key: 'experience',
    re: /^(work|professional|employment|relevant)?\s*(experience|history)$/i,
  },
  { key: 'education', re: /^education(al background)?$/i },
  {
    key: 'skills',
    re: /^(technical |core |key )?(skills?|competencies|technologies)( (&|and) \w+)?$/i,
  },
  { key: 'projects', re: /^(personal |selected |notable |side |academic )?projects$/i },
  { key: 'summary', re: /^(professional |career )?(summary|objective|profile|about( me)?)$/i },
];

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const ONE_DATE = `(${MONTH}\\s+\\d{4}|\\d{1,2}[/.]\\d{4}|\\d{4})`;
const DATE_RANGE = new RegExp(
  `${ONE_DATE}\\s*(?:–|—|−|-|to|through)\\s*(${ONE_DATE.slice(1, -1)}|present|current|now|ongoing)`,
  'i'
);
const PRESENT_RE = /present|current|now|ongoing/i;

const BULLET_RE = /^\s*(?:[•◦▪●○‣∙·*]|-|–|—)\s+/;
const URL_RE = /(https?:\/\/\S+|(?:www\.|github\.com\/|gitlab\.com\/|linkedin\.com\/|bitbucket\.org\/)\S+)/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/;
const LOCATION_RE = /^[A-Za-z .'-]+,\s*(?:[A-Z]{2}|[A-Z][a-z]+)\b|\b(remote|hybrid)\b/i;
const TITLE_RE = /\b(engineer|developer|programmer|manager|analyst|designer|scientist|intern|consultant|lead|architect|director|specialist|administrator|technician|researcher|founder|officer|assistant|coordinator)\b/i;
const SCHOOL_RE = /\b(university|college|institute|polytechnic|academy|school)\b/i;
const DEGREE_RE = /\b(bachelor'?s?|master'?s?|associate'?s?|doctorate|ph\.?\s?d\.?|mba|b\.?\s?(s|a|sc|e|eng|f\.?a)\.?|m\.?\s?(s|a|sc|e|eng|f\.?a)\.?|a\.?\s?(s|a)\.?|diploma|certificate|certification)\b/i;

function isBullet(line: string): boolean {
  // A leading dash followed by a date range is an entry line, not a bullet.
  return BULLET_RE.test(line) && !DATE_RANGE.test(line.slice(0, 30));
}

function stripBullet(line: string): string {
  return line.replace(BULLET_RE, '').trim();
}

function stripDates(line: string): string {
  return line
    .replace(new RegExp(DATE_RANGE.source, 'gi'), '')
    .replace(new RegExp(ONE_DATE, 'gi'), '')
    .replace(/\s*[|•·,]\s*$/g, '')
    .replace(/^\s*[|•·,]\s*/g, '')
    .trim();
}

/** Split "Software Engineer — Acme | Austin, TX"-style lines into segments. */
function segments(line: string): string[] {
  return line
    .split(/\t+|\s{2,}|\s+\|\s+|\s+[–—]\s+|\s+·\s+|\s+•\s+/)
    .map((part) => part.replace(/^[,|]+|[,|]+$/g, '').trim())
    .filter(Boolean);
}

interface Sections {
  preamble: string[];
  bodies: Partial<Record<SectionKey, string[]>>;
  found: SectionKey[];
}

function splitSections(lines: string[]): Sections {
  const preamble: string[] = [];
  const bodies: Partial<Record<SectionKey, string[]>> = {};
  const found: SectionKey[] = [];
  let currentBody: string[] | null = null;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '');
    const candidate = line.trim().replace(/:$/, '').trim();
    const header =
      candidate.length > 0 && candidate.length <= 40
        ? SECTION_HEADERS.find((h) => h.re.test(candidate))
        : undefined;
    if (header) {
      let body = bodies[header.key];
      if (!body) {
        body = [];
        bodies[header.key] = body;
        found.push(header.key);
      }
      currentBody = body;
      continue;
    }
    if (currentBody) currentBody.push(line);
    else preamble.push(line);
  }
  return { preamble, bodies, found };
}

function parseContact(preamble: string[], resume: Resume): void {
  const joined = preamble.join('\n');

  resume.email = EMAIL_RE.exec(joined)?.[0] ?? '';
  const phone = PHONE_RE.exec(joined.replace(EMAIL_RE, ''))?.[0].trim() ?? '';
  resume.phone = phone;

  const links = new Set<string>();
  for (const line of preamble) {
    for (const seg of segments(line)) {
      const url = URL_RE.exec(seg)?.[0];
      if (url && !url.includes('@')) links.add(url.replace(/[.,;)]+$/, ''));
    }
  }
  resume.links = [...links];

  const contentLines = preamble.map((l) => l.trim()).filter(Boolean);
  for (const line of contentLines.slice(0, 5)) {
    const words = line.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      line.length <= 40 &&
      /^[A-Za-z .,'-]+$/.test(line) &&
      !LOCATION_RE.test(line) &&
      !TITLE_RE.test(line)
    ) {
      resume.fullName = line;
      break;
    }
  }

  for (const line of contentLines.slice(0, 8)) {
    for (const seg of segments(line)) {
      if (
        /^[A-Za-z .'-]+,\s*(?:[A-Z]{2}|[A-Za-z .'-]+)$/.test(seg) &&
        !seg.includes('@') &&
        seg !== resume.fullName &&
        !TITLE_RE.test(seg) &&
        seg.length <= 45
      ) {
        resume.location = seg;
        break;
      }
    }
    if (resume.location) break;
  }
}

interface RawEntry {
  head: string[];
  start: string;
  end: string;
  current: boolean;
  bullets: string[];
}

function collectDatedEntries(lines: string[]): RawEntry[] {
  const entries: RawEntry[] = [];
  let cur: RawEntry | null = null;
  let pending: string[] = [];
  // When a section has no bullet markers at all (common in PDF extractions),
  // plain lines after an entry's head are its description rather than the
  // next entry's header.
  const hasBulletMarkers = lines.some((l) => isBullet(l.trim()));

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (isBullet(line)) {
      const text = stripBullet(line);
      if (cur) cur.bullets.push(text);
      continue;
    }

    const match = DATE_RANGE.exec(line);
    if (match) {
      cur = {
        head: pending.slice(-2),
        start: match[1],
        end: PRESENT_RE.test(match[2]) ? '' : match[2],
        current: PRESENT_RE.test(match[2]),
        bullets: [],
      };
      const rest = stripDates(line);
      if (rest) cur.head.push(rest);
      entries.push(cur);
      pending = [];
      continue;
    }

    // Plain line: early lines extend the entry head, later ones likely belong
    // to the next entry (kept in `pending` until its date line shows up).
    if (cur && cur.bullets.length === 0 && cur.head.length < 2) {
      cur.head.push(line);
    } else if (cur && !hasBulletMarkers) {
      cur.bullets.push(line);
    } else {
      pending.push(line);
      if (pending.length > 3) pending.shift();
    }
  }
  return entries;
}

/** Splits "Acme Analytics, Austin, TX" / "Bright Labs, Remote" into company + location. */
const CITY_STATE_TAIL = /,\s*((?:[A-Za-z .'-]+,\s*)?(?:[A-Z]{2}|[Rr]emote|[Hh]ybrid))$/;
const COMPANY_SUFFIX_RE = /\b(inc|llc|ltd|corp|co|gmbh)\b\.?/i;

function toExperience(entry: RawEntry): ResumeExperience {
  let title = '';
  let company = '';
  let location = '';
  const leftovers: string[] = [];

  const parts = entry.head.flatMap(segments).flatMap((part) => {
    // Leave parts that are already just a location ("Austin, TX") intact;
    // "…, Remote" is still split since that's usually "Company, Remote".
    if (/^[A-Za-z .'-]+,\s*[A-Z]{2}$/.test(part)) return [part];
    const tail = CITY_STATE_TAIL.exec(part);
    if (!tail) return [part];
    const prefix = part.slice(0, tail.index).trim();
    return prefix ? [prefix, tail[1]] : [part];
  });

  for (const part of parts) {
    if (!location && LOCATION_RE.test(part) && part.length <= 45 && !COMPANY_SUFFIX_RE.test(part)) {
      location = part;
    } else if (!title && TITLE_RE.test(part)) {
      title = part;
    } else if (!company) {
      company = part;
    } else {
      leftovers.push(part);
    }
  }
  if (!title && leftovers.length > 0) title = leftovers[0];

  return {
    id: randomUUID(),
    company,
    title,
    location,
    start: entry.start,
    end: entry.end,
    current: entry.current,
    bullets: entry.bullets.map((text) => ({ id: randomUUID(), text, included: true })),
    included: true,
  };
}

function parseEducation(lines: string[]): ResumeEducation[] {
  const entries: ResumeEducation[] = [];
  let cur: ResumeEducation | null = null;

  for (const raw of lines) {
    const line = stripBullet(raw.trim());
    if (!line) continue;
    const isSchool = SCHOOL_RE.test(line);
    const isDegree = DEGREE_RE.test(line);
    if (!cur && !isSchool && !isDegree) continue;

    // A second school (or second degree without a school on the same line)
    // starts a new entry.
    if (cur && ((isSchool && cur.school) || (isDegree && cur.degree && !isSchool))) {
      cur = null;
    }
    if (!cur) {
      cur = {
        id: randomUUID(),
        school: '',
        degree: '',
        field: '',
        start: '',
        end: '',
        included: true,
      };
      entries.push(cur);
    }

    const range = DATE_RANGE.exec(line);
    if (range) {
      cur.start ||= range[1];
      cur.end ||= PRESENT_RE.test(range[2]) ? '' : range[2];
    } else {
      const years = line.match(/\b(?:19|20)\d{2}\b/g);
      if (years && !cur.end) cur.end = years[years.length - 1];
    }

    const text = stripDates(line);
    if (isSchool && !cur.school) {
      cur.school = segments(text).find((s) => SCHOOL_RE.test(s)) ?? text;
    }
    if (isDegree && !cur.degree) {
      const degreeSeg = segments(text).find((s) => DEGREE_RE.test(s)) ?? text;
      // Split at " in " so "Bachelor of Science in X" keeps its full degree name.
      const inField = /(.+?)\s+in\s+(.+)/.exec(degreeSeg);
      if (inField) {
        cur.degree = inField[1].trim();
        cur.field = inField[2].replace(/[,;].*$/, '').trim();
      } else {
        cur.degree = degreeSeg;
      }
    }
  }
  return entries.filter((e) => e.school || e.degree);
}

function parseSkills(lines: string[]): ResumeSkill[] {
  const seen = new Set<string>();
  const skills: ResumeSkill[] = [];
  for (const raw of lines) {
    // Drop "Languages:"-style category labels, keep what follows.
    const line = stripBullet(raw.trim()).replace(/^[A-Za-z /&()-]{2,30}:\s*/, '');
    for (const part of line.split(/[,•|;·\t]+|\s{2,}/)) {
      const name = part.trim().replace(/[.]+$/, '');
      if (!name || name.length > 40 || /^\d+$/.test(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push({ id: randomUUID(), name, included: true });
    }
  }
  return skills;
}

function parseProjects(lines: string[]): ResumeProject[] {
  const projects: ResumeProject[] = [];
  let cur: ResumeProject | null = null;
  let curDescription: string[] = [];

  const flush = () => {
    if (cur) cur.description = curDescription.join(' ');
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (cur && (isBullet(line) || line.length > 80)) {
      curDescription.push(stripBullet(line));
      continue;
    }
    const name = stripDates(line.replace(URL_RE, '')).replace(/[|•·,—–-]+\s*$/, '').trim();
    if (!name) continue;
    flush();
    cur = {
      id: randomUUID(),
      name: segments(name)[0] ?? name,
      url: URL_RE.exec(line)?.[0].replace(/[.,;)]+$/, '') ?? '',
      description: '',
      included: true,
    };
    curDescription = [];
    projects.push(cur);
  }
  flush();
  return projects.filter((p) => p.name);
}

/**
 * Best-effort parser: turns extracted resume text into a Resume the renderer
 * can merge into the master resume. Everything it cannot confidently place is
 * reported through `warnings` so the user knows what to fill in by hand.
 */
export function parseResumeText(text: string): { resume: Resume; warnings: string[] } {
  const resume: Resume = JSON.parse(JSON.stringify(DEFAULT_RESUME));
  const warnings: string[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const { preamble, bodies, found } = splitSections(lines);

  parseContact(preamble, resume);
  if (!resume.fullName && !resume.email) {
    warnings.push('Could not find a name or email near the top of the file.');
  }

  if (bodies.summary) {
    resume.summary = bodies.summary.map((l) => l.trim()).filter(Boolean).join(' ');
  }
  if (bodies.skills) {
    resume.skills = parseSkills(bodies.skills);
  }
  if (bodies.experience) {
    resume.experience = collectDatedEntries(bodies.experience).map(toExperience);
    if (resume.experience.length === 0) {
      warnings.push('An experience section was found but no dated entries could be read from it.');
    }
  }
  if (bodies.education) {
    resume.education = parseEducation(bodies.education);
  }
  if (bodies.projects) {
    resume.projects = parseProjects(bodies.projects);
  }

  if (found.length === 0) {
    warnings.push(
      'No standard sections (Experience, Education, Skills…) were detected — only contact details were imported.'
    );
  } else {
    for (const key of ['experience', 'education', 'skills'] as const) {
      if (!bodies[key]) warnings.push(`No ${key} section was detected.`);
    }
  }

  return { resume, warnings };
}
