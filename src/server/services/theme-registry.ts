import type { ThemeInfo } from '../schemas/index.js';

const THEMES: ThemeInfo[] = [
  { id: 'light-default', label: 'Light Default', variant: 'light' },
  { id: 'light-warm', label: 'Light Warm', variant: 'light' },
  { id: 'dark-default', label: 'Dark Default', variant: 'dark' },
  { id: 'dark-cool', label: 'Dark Cool', variant: 'dark' },
];

export const themeRegistry = {
  getAll(): ThemeInfo[] {
    return THEMES;
  },
  isValid(id: string): boolean {
    return THEMES.some((t) => t.id === id);
  },
};
