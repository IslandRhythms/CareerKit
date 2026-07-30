export interface UsState {
  name: string;
  abbr: string;
}

export const US_STATES: UsState[] = [
  { name: 'Alabama', abbr: 'AL' },
  { name: 'Alaska', abbr: 'AK' },
  { name: 'Arizona', abbr: 'AZ' },
  { name: 'Arkansas', abbr: 'AR' },
  { name: 'California', abbr: 'CA' },
  { name: 'Colorado', abbr: 'CO' },
  { name: 'Connecticut', abbr: 'CT' },
  { name: 'Delaware', abbr: 'DE' },
  { name: 'District of Columbia', abbr: 'DC' },
  { name: 'Florida', abbr: 'FL' },
  { name: 'Georgia', abbr: 'GA' },
  { name: 'Hawaii', abbr: 'HI' },
  { name: 'Idaho', abbr: 'ID' },
  { name: 'Illinois', abbr: 'IL' },
  { name: 'Indiana', abbr: 'IN' },
  { name: 'Iowa', abbr: 'IA' },
  { name: 'Kansas', abbr: 'KS' },
  { name: 'Kentucky', abbr: 'KY' },
  { name: 'Louisiana', abbr: 'LA' },
  { name: 'Maine', abbr: 'ME' },
  { name: 'Maryland', abbr: 'MD' },
  { name: 'Massachusetts', abbr: 'MA' },
  { name: 'Michigan', abbr: 'MI' },
  { name: 'Minnesota', abbr: 'MN' },
  { name: 'Mississippi', abbr: 'MS' },
  { name: 'Missouri', abbr: 'MO' },
  { name: 'Montana', abbr: 'MT' },
  { name: 'Nebraska', abbr: 'NE' },
  { name: 'Nevada', abbr: 'NV' },
  { name: 'New Hampshire', abbr: 'NH' },
  { name: 'New Jersey', abbr: 'NJ' },
  { name: 'New Mexico', abbr: 'NM' },
  { name: 'New York', abbr: 'NY' },
  { name: 'North Carolina', abbr: 'NC' },
  { name: 'North Dakota', abbr: 'ND' },
  { name: 'Ohio', abbr: 'OH' },
  { name: 'Oklahoma', abbr: 'OK' },
  { name: 'Oregon', abbr: 'OR' },
  { name: 'Pennsylvania', abbr: 'PA' },
  { name: 'Puerto Rico', abbr: 'PR' },
  { name: 'Rhode Island', abbr: 'RI' },
  { name: 'South Carolina', abbr: 'SC' },
  { name: 'South Dakota', abbr: 'SD' },
  { name: 'Tennessee', abbr: 'TN' },
  { name: 'Texas', abbr: 'TX' },
  { name: 'Utah', abbr: 'UT' },
  { name: 'Vermont', abbr: 'VT' },
  { name: 'Virginia', abbr: 'VA' },
  { name: 'Washington', abbr: 'WA' },
  { name: 'West Virginia', abbr: 'WV' },
  { name: 'Wisconsin', abbr: 'WI' },
  { name: 'Wyoming', abbr: 'WY' },
];

/** Finds a state by full name or abbreviation, case-insensitive. */
export function findState(input: string): UsState | undefined {
  const t = input.trim().toLowerCase();
  if (!t) return undefined;
  return US_STATES.find((s) => s.name.toLowerCase() === t || s.abbr.toLowerCase() === t);
}

function stateMentioned(text: string, state: UsState): boolean {
  // Abbreviations match case-sensitively ("Austin, TX") so that words like
  // "in" or "or" in a location string don't read as Indiana or Oregon.
  const abbrPattern = new RegExp(`(^|[^A-Za-z])${state.abbr}([^A-Za-z]|$)`);
  return abbrPattern.test(text) || text.toLowerCase().includes(state.name.toLowerCase());
}

function anyStateMentioned(text: string): UsState | undefined {
  return US_STATES.find((s) => stateMentioned(text, s));
}

/**
 * True if a job posting's location text matches a preferred location.
 * Preferred locations may be "Austin, TX", "Austin, Texas", "Texas", "TX", or a bare city.
 * When a city and state are both given, a job in the same-named city of a different
 * state does not match.
 */
export function locationMatches(jobLocation: string, preferred: string): boolean {
  const jobLower = jobLocation.toLowerCase();
  const parts = preferred.split(',').map((p) => p.trim()).filter(Boolean);
  if (!jobLower.trim() || parts.length === 0) return false;

  const state = findState(parts[parts.length - 1]);
  const city = (state ? parts.slice(0, -1) : parts).join(', ').toLowerCase();

  if (city && state) {
    if (!jobLower.includes(city)) return false;
    if (stateMentioned(jobLocation, state)) return true;
    // City matched but the posting names some other state — treat as a different city.
    return anyStateMentioned(jobLocation) === undefined;
  }
  if (state) {
    return stateMentioned(jobLocation, state);
  }
  return jobLower.includes(city);
}
