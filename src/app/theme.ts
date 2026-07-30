import { DEFAULT_THEME, ThemeSettings } from '../shared/types';

export const THEME_PRESETS: Array<{ name: string; color: string }> = [
  { name: 'Sunset', color: '#f97316' },
  { name: 'Amber', color: '#f59e0b' },
  { name: 'Coral', color: '#fb7185' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Teal', color: '#14b8a6' },
  { name: 'Indigo', color: '#6366f1' },
  { name: 'Violet', color: '#8b5cf6' },
];

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Applies mode and accent to the document. Bulma 1.x is fully CSS-variable
 * driven, so re-pointing the primary/link hue variables re-themes every
 * component; `data-theme` forces light/dark while `system` follows the OS.
 */
export function applyTheme(theme: ThemeSettings | undefined): void {
  const { mode, primary } = theme ?? DEFAULT_THEME;
  const root = document.documentElement;

  if (mode === 'light' || mode === 'dark') {
    root.setAttribute('data-theme', mode);
  } else {
    root.removeAttribute('data-theme');
  }

  const hsl = hexToHsl(primary) ?? hexToHsl(DEFAULT_THEME.primary);
  if (!hsl) return;
  for (const name of ['primary', 'link']) {
    root.style.setProperty(`--bulma-${name}-h`, `${hsl.h}deg`);
    root.style.setProperty(`--bulma-${name}-s`, `${hsl.s}%`);
    root.style.setProperty(`--bulma-${name}-l`, `${hsl.l}%`);
  }
  root.style.setProperty('--ck-accent', `hsl(${hsl.h}deg ${hsl.s}% ${hsl.l}%)`);
  root.style.setProperty('--ck-accent-soft', `hsl(${hsl.h}deg ${hsl.s}% ${hsl.l}% / 0.14)`);
}
