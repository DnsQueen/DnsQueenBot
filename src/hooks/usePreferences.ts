/**
 * UI preferences: language and theme.
 *
 * Two independent keys, two independent switches. A failure in storage is never
 * fatal — the app falls back to the defaults (Persian, dark) and keeps running.
 * Only preferences live here; pasted text, files and address lists never do.
 */
import { useCallback, useState } from 'react';
import { locale, translate, type Lang, type TranslationKey } from '../i18n/translations';

export type Theme = 'light' | 'dark';

export const LANG_KEY = 'dnsqueen.language';
export const THEME_KEY = 'dnsqueen.theme';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode, quota, or a locked-down webview: preferences are just not saved */
  }
}

const initialLang = (): Lang => {
  const stored = read(LANG_KEY);
  if (stored === 'fa' || stored === 'en') return stored;
  return 'fa';
};

const initialTheme = (): Theme => (read(THEME_KEY) === 'light' ? 'light' : 'dark');

export function usePreferences() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next: Lang = prev === 'fa' ? 'en' : 'fa';
      write(LANG_KEY, next);
      return next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      write(THEME_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  return { lang, theme, toggleLang, toggleTheme, t, dir: locale[lang].dir };
}
