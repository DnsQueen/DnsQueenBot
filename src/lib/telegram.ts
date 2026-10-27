/**
 * Telegram Mini App integration (official `telegram-web-app.js` SDK).
 *
 * Deliberately tiny and side-effect free: no bot token, no network calls, no
 * user data leaves the device. Everything here is feature-detected so the app
 * keeps working as a plain web page (and under jsdom in tests) when the SDK
 * script is absent.
 *
 * Docs: https://core.telegram.org/bots/webapps
 */

type ColorScheme = 'light' | 'dark';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: Record<string, unknown>;
  version: string;
  platform: string;
  colorScheme: ColorScheme;
  themeParams: Record<string, string>;
  isExpanded: boolean;
  viewportHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  onEvent: (event: string, handler: () => void) => void;
  offEvent: (event: string, handler: () => void) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  disableVerticalSwipes?: () => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Chrome of the app, matched to the dark bat-purple plate. */
const CHROME = {
  header: '#0B0912',
  background: '#0B0912',
  bottom: '#0B0912',
};

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  // `initData` is empty when the page is opened in a normal browser tab,
  // so it is the reliable "am I inside Telegram" signal.
  return Boolean(getWebApp()?.initData);
}

/** Colour scheme Telegram reports, or null outside Telegram. */
export function telegramScheme(): ColorScheme | null {
  const app = getWebApp();
  if (!app || !app.initData) return null;
  return app.colorScheme === 'light' ? 'light' : 'dark';
}

/**
 * Boots the Mini App: signals readiness, expands to full height and paints the
 * Telegram chrome with our own colours so there is no grey seam at the top.
 */
export function initTelegram(): () => void {
  const app = getWebApp();
  if (!app) return () => {};

  const cleanups: Array<() => void> = [];

  try {
    app.ready();
    app.expand();
    app.setHeaderColor?.(CHROME.header);
    app.setBackgroundColor?.(CHROME.background);
    app.setBottomBarColor?.(CHROME.bottom);
    // Keeps the swipe-down gesture from closing the app mid-edit.
    app.disableVerticalSwipes?.();
  } catch {
    /* older clients: the app still works, just without the chrome tuning */
  }

  const onViewport = () => {
    // Telegram reports the real visible height; expose it for the CSS layer.
    document.documentElement.style.setProperty('--tg-vh', `${app.viewportHeight}px`);
  };
  onViewport();

  try {
    app.onEvent('viewportChanged', onViewport);
    cleanups.push(() => app.offEvent('viewportChanged', onViewport));
  } catch {
    /* no-op */
  }

  return () => cleanups.forEach(fn => fn());
}

/** Short haptic tap; silently ignored outside Telegram. */
export function haptic(kind: 'tap' | 'ok' | 'warn' | 'error' = 'tap') {
  const hf = getWebApp()?.HapticFeedback;
  if (!hf) return;
  try {
    if (kind === 'tap') hf.selectionChanged();
    else if (kind === 'ok') hf.notificationOccurred('success');
    else if (kind === 'warn') hf.notificationOccurred('warning');
    else hf.notificationOccurred('error');
  } catch {
    /* no-op */
  }
}
/** Light chrome, matched to the light theme plate. */
const CHROME_LIGHT = { header: '#F7F5FB', background: '#F7F5FB', bottom: '#F7F5FB' };

/**
 * Repaints Telegram's header/background/bottom bar for the active theme.
 * A no-op outside Telegram, so the plain web build is unaffected. Never touches
 * the user's theme choice — it only mirrors it into the host chrome.
 */
export function setTelegramChrome(theme: 'light' | 'dark'): void {
  const app = getWebApp();
  if (!app || !app.initData) return;
  const colours = theme === 'light' ? CHROME_LIGHT : CHROME;
  try {
    app.setHeaderColor?.(colours.header);
    app.setBackgroundColor?.(colours.background);
    app.setBottomBarColor?.(colours.bottom);
  } catch {
    /* older clients: ignore */
  }
}
