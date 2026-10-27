/**
 * Clipboard helpers with a layered fallback:
 *  1. navigator.clipboard.writeText (needs a secure context)
 *  2. navigator.clipboard.write + ClipboardItem (some webviews only allow this)
 *  3. hidden textarea + document.execCommand('copy') (older Telegram Android webviews)
 * Every failure is reported, never swallowed: the UI decides what to tell the user.
 */

export type CopyMethod = 'async' | 'item' | 'execCommand';

export class CopyError extends Error {
  readonly reason: 'empty' | 'blocked';
  constructor(message: string, reason: 'empty' | 'blocked') {
    super(message);
    this.name = 'CopyError';
    this.reason = reason;
  }
}

function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.width = '1px';
  ta.style.height = '1px';
  ta.style.padding = '0';
  ta.style.border = 'none';
  ta.style.background = 'transparent';
  ta.style.opacity = '0';
  document.body.appendChild(ta);

  const selection = document.getSelection();
  const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  let ok = false;
  try {
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  document.body.removeChild(ta);
  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }
  return ok;
}

export async function copyText(text: string): Promise<CopyMethod> {
  if (!text) throw new CopyError('Nothing to copy yet — paste a list first.', 'empty');

  const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  const secure = typeof window !== 'undefined' && window.isSecureContext;

  if (clip && typeof clip.writeText === 'function' && secure) {
    try {
      await clip.writeText(text);
      return 'async';
    } catch {
      /* try the next strategy */
    }
  }

  if (clip && typeof clip.write === 'function' && secure && typeof ClipboardItem !== 'undefined') {
    try {
      await clip.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      return 'item';
    } catch {
      /* try the next strategy */
    }
  }

  if (legacyCopy(text)) return 'execCommand';

  throw new CopyError(
    'The browser blocked clipboard access here. Copy the text straight from the output box instead.',
    'blocked',
  );
}

/** Download text as a .txt file. `withBom` makes Windows Notepad read UTF-8 correctly. */
export function downloadText(filename: string, text: string, withBom = false): void {
  const parts: BlobPart[] = withBom ? ['\uFEFF', text] : [text];
  const blob = new Blob(parts, { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // iOS/Safari needs the URL to stay alive for a moment.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Timestamped, filesystem-safe name, e.g. dnsqueen-20261027-1750.txt */
export function txtFilename(prefix = 'dnsqueen'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.txt`;
}