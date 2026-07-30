/**
 * Word-boundary-ish phrase matching: "java" doesn't match "javascript",
 * but "c++" and ".net" still work.
 */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return pattern.test(haystack);
}

/** True if every whitespace-separated token of the query appears in the text. */
export function matchesQuery(text: string, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((token) => containsPhrase(text, token));
}
