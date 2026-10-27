import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

const LANG_KEY = 'dnsqueen.language';
const THEME_KEY = 'dnsqueen.theme';

const $lang = () => screen.getByTestId('lang-toggle');
const $theme = () => screen.getByTestId('theme-toggle');
const $input = () => screen.getByLabelText('Raw text to extract addresses from');
const $region = () => document.querySelector('.out') as HTMLElement;
const $switch = (name: string) => screen.getByRole('switch', { name });

const mount = () => render(<App />);
const toEnglish = () => fireEvent.click($lang());
const paste = (text: string) => fireEvent.change($input(), { target: { value: text } });

beforeEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('language', () => {
  it('starts in Persian: fa + rtl', () => {
    mount();
    expect(document.documentElement.lang).toBe('fa');
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('DNSQUEEN');
  });

  it('switches the whole interface to English: en + ltr, no reload', () => {
    mount();
    toEnglish();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect($input()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download TXT' })).toBeInTheDocument();
    expect($switch('Hide private')).toBeInTheDocument();
    expect($switch('Hide special-use')).toBeInTheDocument();
    expect(screen.getByText(/Runs entirely in your browser/)).toBeInTheDocument();
  });

  it('translates empty state, errors and toasts', () => {
    mount();
    toEnglish();
    expect($region().textContent).toMatch(/Nothing to clean yet/);
    paste('999.1.1.1 and 1.2.3.4.5');
    expect($region().textContent).toMatch(/No valid address/);
    fireEvent.click(screen.getByRole('button', { name: 'Download TXT' }));
    expect(screen.getByRole('status').textContent).toMatch(/Nothing to download yet/);
  });

  it('never touches the data when the language changes', () => {
    mount();
    toEnglish();
    paste('8.8.8.8:53, [2001:db8::1]:853, 203.0.113.14');
    // Category labels are UI text and must translate; the addresses themselves
    // and the pasted input are data and must stay byte-identical.
    const addresses = () =>
      Array.from(document.querySelectorAll('.out__row')).map(row =>
        (row.querySelector('.out__ip')?.textContent ?? '').trim(),
      );
    const before = addresses();
    const input = $input() as HTMLTextAreaElement;
    const rawBefore = input.value;
    fireEvent.click($lang());
    expect(document.documentElement.lang).toBe('fa');
    expect(addresses()).toEqual(before);
    expect(addresses()).toEqual(['8.8.8.8', '2001:db8::1', '203.0.113.14']);
    expect(input.value).toBe(rawBefore);
    expect($region().querySelectorAll('.out__row').length).toBe(3);
  });
});

describe('theme', () => {
  it('is independent of language and does not reset it', () => {
    mount();
    toEnglish();
    fireEvent.click($theme());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.lang).toBe('en');
    fireEvent.click($theme());
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('en');
  });

  it('persists language and theme under two separate keys', () => {
    mount();
    toEnglish();
    fireEvent.click($theme());
    expect(localStorage.getItem(LANG_KEY)).toBe('en');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    cleanup();
    mount();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('renders all four language and theme combinations', () => {
    for (const [lang, theme, dir] of [
      ['fa', 'dark', 'rtl'],
      ['fa', 'light', 'rtl'],
      ['en', 'dark', 'ltr'],
      ['en', 'light', 'ltr'],
    ] as const) {
      cleanup();
      localStorage.setItem(LANG_KEY, lang);
      localStorage.setItem(THEME_KEY, theme);
      mount();
      expect(document.documentElement.lang).toBe(lang);
      expect(document.documentElement.dir).toBe(dir);
      expect(document.documentElement.dataset.theme).toBe(theme);
    }
  });

  it('still renders when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => mount()).not.toThrow();
    expect(document.documentElement.lang).toBe('fa');
    expect(() => fireEvent.click($lang())).not.toThrow();
    expect(() => fireEvent.click($theme())).not.toThrow();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('controls actually drive the engine', () => {
  it('Hide special-use removes documentation ranges, Hide private does not', () => {
    mount();
    toEnglish();
    paste('8.8.8.8 203.0.113.14 192.168.1.1');
    expect($region().textContent).toMatch(/203\.0\.113\.14/);
    fireEvent.click($switch('Hide private'));
    expect($region().textContent).not.toMatch(/192\.168\.1\.1/);
    expect($region().textContent).toMatch(/203\.0\.113\.14/);
    fireEvent.click($switch('Hide special-use'));
    expect($region().textContent).not.toMatch(/203\.0\.113\.14/);
    expect($region().textContent).toMatch(/8\.8\.8\.8/);
  });

  it('keeps port, ordering and dedupe working after a language and theme change', () => {
    mount();
    toEnglish();
    fireEvent.click($theme());
    fireEvent.click($switch('Keep port'));
    paste('9.9.9.9:53\n1.1.1.1:53\n9.9.9.9:53\n1.1.1.1:443');
    const text = $region().textContent ?? '';
    expect(text).toMatch(/1\.1\.1\.1:53/);
    expect(text).toMatch(/1\.1\.1\.1:443/);
    expect($region().querySelectorAll('.out__row').length).toBe(3);
  });

  it('copies the full output to the clipboard', async () => {
    // navigator.clipboard only exists in a secure context (https / Telegram
    // webview); jsdom reports false, so opt in the way the real app does.
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mount();
    toEnglish();
    paste('8.8.8.8 1.1.1.1');
    fireEvent.click(screen.getByRole('button', { name: 'Copy all' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toBe('8.8.8.8\n1.1.1.1');
  });
});
