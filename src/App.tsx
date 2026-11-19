import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './App.css';
import { useParser, usePersistentSettings, useToast, type Settings } from './hooks/useParser';
import { usePreferences } from './hooks/usePreferences';
import { copyText, CopyError, downloadText, txtFilename } from './lib/clipboard';
import { haptic, setTelegramChrome } from './lib/telegram';
import { locale, type TranslationKey } from './i18n/translations';
import type { ExtractedIp } from './engine/ip-parser';

const MAX_FILE_BYTES = 2_000_000;
const RENDER_CAP = 400;

const SAMPLE = `ns1.edge.example.net  A  203.0.113.14
8.8.8.8:53, 1.1.1.1:53, 9.9.9.9#53
resolver-ams [2001:4860:4860::8888]:53
2001:0db8:0000:0000:0000:0000:0000:0001
2001:db8::1
10.0.0.1 192.168.1.1 172.16.4.9
8.8.8.8
https://dns.example.com/v1?server=208.67.222.222&port=5353
updated 2024.10.27 by app v1.2.3.4 build 9
bad: 999.1.1.1 and 1.2.3.4.5 and 256.0.0.1
cidr: 104.16.0.0/12, 2606:4700::/32
notes 2026-01-04: 45.90.28.11`;

type Tone = 'ok' | 'warn' | 'error';

/** Engine category → translation key. Data-driven, so a new category can never
 *  silently print an English word inside the Persian interface. */
const CATEGORY_KEY: Record<string, TranslationKey | undefined> = {
  public: 'cat.public',
  private: 'cat.private',
  loopback: 'cat.loopback',
  linklocal: 'cat.linklocal',
  'link-local': 'cat.linklocal',
  documentation: 'cat.documentation',
  multicast: 'cat.multicast',
  reserved: 'cat.reserved',
};

const FORMAT_HINT: Record<Settings['outputFormat'], TranslationKey> = {
  newline: 'format.hint.newline',
  comma: 'format.hint.comma',
  space: 'format.hint.space',
  json: 'format.hint.json',
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={hint}
      className={classNames('toggle', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__dot" aria-hidden="true" />
      <span className="toggle__label" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      <span className="seg__label" aria-hidden="true">
        {label}
      </span>
      <div className="seg__track">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            className={classNames('seg__btn', value === o.value && 'is-active')}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A row's identity across parses. With ports kept, the same address on two
 *  ports is two rows; with ports stripped, it is one — so the port only
 *  belongs in the key when keepPort is on. */
function rowKey(ip: ExtractedIp, keepPort: boolean): string {
  return keepPort && ip.port !== undefined ? `${ip.baseIp}:${ip.port}` : ip.baseIp;
}

export default function App() {
  const [source, setSource] = useState('');
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { lang, theme, toggleLang, toggleTheme, t } = usePreferences();
  const { settings, update, reset } = usePersistentSettings();
  const { toast, push } = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const dropTimer = useRef<number | null>(null);

  const result = useParser(source, settings);
  const rows = result.items;
  const output = result.formattedOutput;

  const lineCount = useMemo(
    () => (source.match(/\n/g)?.length ?? 0) + (source.trim() ? 1 : 0),
    [source],
  );

  /* Document-level language and direction; data stays LTR everywhere. */
  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale[lang].lang;
    root.dir = locale[lang].dir;
  }, [lang]);

  /* Theme: our attribute drives the CSS layer, and Telegram's chrome follows it. */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    setTelegramChrome(theme);
  }, [theme]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  /* Rows that appeared since the previous parse stay lit amber until the
   * next keystroke. The first paste lights nothing: the whole board is new. */
  const prevKeysRef = useRef<Set<string>>(new Set());
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const keys = new Set(rows.map(ip => rowKey(ip, settings.keepPort)));
    const prev = prevKeysRef.current;
    const fresh =
      prev.size === 0 ? new Set<string>() : new Set([...keys].filter(k => !prev.has(k)));
    /* Amber marks the exception, not the rule: when more than half the board
     * is fresh, the board was replaced wholesale and the flip cascade alone
     * carries it — lighting everything would say nothing. */
    if (fresh.size > keys.size / 2) fresh.clear();
    prevKeysRef.current = keys;
    setFreshKeys(fresh);
  }, [rows, settings.keepPort]);

  /* FIRST VIEWPORT: the input field is focused on load — on devices with a
   * fine pointer only, so a phone never opens its keyboard uninvited. */
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: fine)').matches
    ) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const undoAction = useCallback(
    (previous: string) => ({
      label: t('action.restore'),
      run: () => {
        setSource(previous);
        push(t('toast.restored'));
      },
    }),
    [push, t],
  );

  const ingestFile = useCallback(
    async (file: File) => {
      const isText =
        file.type === '' ||
        file.type === 'text/plain' ||
        file.type === 'text/csv' ||
        /\.(txt|csv|list)$/i.test(file.name);
      if (!isText) {
        push(t('toast.fileType'), 'error');
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        push(t('toast.fileTooBig', { size: (file.size / 1_000_000).toFixed(1) }), 'error');
        return;
      }
      setBusyFile(file.name);
      try {
        const text = await file.text();
        if (!text.trim()) {
          push(t('toast.fileEmpty'), 'warn', undoAction(source));
          setSource('');
          return;
        }
        setSource(text);
        push(t('toast.fileLoaded', { name: file.name }), 'ok', undoAction(source));
      } catch {
        push(t('toast.fileUnreadable'), 'error');
      } finally {
        setBusyFile(null);
      }
    },
    [push, t, source, undoAction],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void ingestFile(file);
    },
    [ingestFile],
  );

  const handleCopy = useCallback(async () => {
    try {
      await copyText(output);
      setCopied(true);
      haptic('ok');
      push(t('toast.copied'));
    } catch (err) {
      haptic('error');
      if (err instanceof CopyError) {
        push(t(err.reason === 'empty' ? 'toast.copyEmpty' : 'toast.copyBlocked'), err.reason === 'empty' ? 'warn' : 'error');
      } else {
        push(t('toast.copyFailed'), 'error');
      }
    }
  }, [output, push, t]);

  const handleCopyRow = useCallback(
    async (ip: string) => {
      try {
        await copyText(ip);
        haptic('ok');
        push(t('toast.copiedRow', { ip }));
      } catch {
        haptic('error');
        push(t('toast.copyFailed'), 'error');
      }
    },
    [push, t],
  );

  const handleDownload = useCallback(() => {
    if (!output) return;
    const ext = settings.outputFormat === 'json' ? 'json' : 'txt';
    const name = txtFilename('dnsqueen').replace(/\.txt$/, `.${ext}`);
    downloadText(name, output, false);
    push(t('toast.saved', { name, n: rows.length }));
  }, [output, settings.outputFormat, push, t, rows.length]);

  const patch = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => update(key, value),
    [update],
  );

  const handleReset = useCallback(() => {
    reset();
    push(t('toast.reset'));
  }, [reset, push, t]);

  const handleClear = useCallback(() => {
    if (!source.trim()) return;
    const previous = source;
    setSource('');
    push(t('toast.cleared'), 'warn', undoAction(previous));
  }, [source, push, t, undoAction]);

  const handleSample = useCallback(() => {
    const previous = source;
    setSource(SAMPLE);
    push(t('toast.sampleLoaded'), 'ok', undoAction(previous));
  }, [source, push, t, undoAction]);

  const shown = rows.slice(0, RENDER_CAP);
  const isEmptyInput = !source.trim();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
              <path
                d="M5.5 10.2 10.7 15.1 16 6.3 21.3 15.1 26.5 10.2 24.4 23.5H7.6L5.5 10.2Z"
                fill="currentColor"
                fillOpacity=".12"
                stroke="currentColor"
                strokeWidth="1.45"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.2 26H23.8M9 23.5V26M23 23.5V26"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
              <path
                d="M16 11.1 18.5 13.6 16 16.1 13.5 13.6 16 11.1Z"
                fill="currentColor"
              />
              <circle cx="5.5" cy="9.2" r="1.35" fill="currentColor"/>
              <circle cx="16" cy="5.1" r="1.35" fill="currentColor"/>
              <circle cx="26.5" cy="9.2" r="1.35" fill="currentColor"/>
            </svg>
          </span>
          <div className="brand__text">
            <h1>{t('app.name')}</h1>
            <p>{t('app.tagline')}</p>
          </div>
        </div>

        <div className="topbar__tools">
          <button
            type="button"
            className="toolbtn"
            data-testid="lang-toggle"
            onClick={toggleLang}
            aria-label={t('nav.lang')}
            title={t('nav.lang')}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.8 8h12.4M8 1.8c1.9 1.7 2.8 3.9 2.8 6.2S9.9 12.5 8 14.2C6.1 12.5 5.2 10.3 5.2 8S6.1 3.5 8 1.8Z" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            <span>{lang === 'fa' ? 'English' : 'فارسی'}</span>
          </button>
          <button
            type="button"
            className="toolbtn"
            data-testid="theme-toggle"
            onClick={toggleTheme}
            aria-label={t('nav.theme')}
            title={t('nav.theme')}
            aria-pressed={theme === 'light'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9 13 13M13 3l-1.1 1.1M4.1 11.9 3 13" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.7 5.7 0 1 0 6.8 6.8Z" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
            <span>{theme === 'dark' ? t('nav.theme.toLight') : t('nav.theme.toDark')}</span>
          </button>
        </div>
      </header>

      <section className="strip" aria-label={t('summary.aria')}>
        <div className="strip__cell strip__cell--big">
          <b>{rows.length}</b>
          <span>{t('meter.unique')}</span>
        </div>
        <div className="strip__cell">
          <b>{result.stats.totalFound}</b>
          <span>{t('strip.found')}</span>
        </div>
        <div className="strip__cell">
          <b>{result.stats.duplicatesRemoved}</b>
          <span>{t('strip.duplicates')}</span>
        </div>
        <div className="strip__cell">
          <b>{result.stats.privateFiltered}</b>
          <span>{t('strip.removedPrivate')}</span>
        </div>
        <div className="strip__cell">
          <b>{result.stats.specialFiltered}</b>
          <span>{t('strip.removedSpecial')}</span>
        </div>
        <div className="strip__cell">
          <b>
            {result.stats.ipv4Count}
            <i>/</i>
            {result.stats.ipv6Count}
          </b>
          <span>{t('strip.v4v6')}</span>
        </div>
      </section>
      {(rows.length > 0 || result.stats.invalidCidrCount > 0) && (
        <p className="strip__note">
          {result.stats.executionTimeMs.toFixed(1)} ms
          {result.stats.invalidCidrCount > 0 && (
            <span className="strip__note--bad">
              {' '}· {t('strip.invalidCidr', { n: result.stats.invalidCidrCount })}
            </span>
          )}
        </p>
      )}

      <main className="grid">
        <div className="pane pane--in">
          <div className="pane__head">
            <h2>
              {t('pane.source')} <span className="pane__meta">{t('pane.lines', { n: lineCount })}</span>
            </h2>
            <div className="pane__actions">
              <button type="button" className="link" onClick={() => fileInput.current?.click()}>
                {busyFile ? t('action.reading') : t('action.openTxt')}
              </button>
              <button type="button" className="link" onClick={handleSample}>
                {t('action.sample')}
              </button>
              <button
                type="button"
                className="link link--quiet"
                onClick={handleClear}
                disabled={isEmptyInput}
              >
                {t('action.clear')}
              </button>
            </div>
          </div>
          <div
            className={classNames('dropzone', dragging && 'is-dragging')}
            onDragOver={e => {
              e.preventDefault();
              if (dropTimer.current) window.clearTimeout(dropTimer.current);
              setDragging(true);
            }}
            onDragLeave={() => {
              dropTimer.current = window.setTimeout(() => setDragging(false), 80);
            }}
            onDrop={onDrop}
          >
            <textarea
              ref={inputRef}
              className="input"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              dir="ltr"
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder={t('input.placeholder')}
              aria-label={t('input.aria')}
            />
            {isEmptyInput && <span className="dropzone__hint">{t('input.dropHint')}</span>}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".txt,.csv,.list,text/plain"
            className="visually-hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void ingestFile(f);
              e.target.value = '';
            }}
          />
        </div>

        <div className="pane pane--out">
          <div className="pane__head">
            <h2>
              {t('pane.output')} <span className="pane__meta">{t('pane.lines', { n: rows.length })}</span>
            </h2>
          </div>
          <div className="board__head" aria-hidden="true">
            <span>#</span>
            <span>{t('board.col.address')}</span>
            <span>{t('board.col.version')}</span>
            <span>{t('board.col.category')}</span>
            <span>{t('board.col.status')}</span>
            <span />
          </div>
          <div className="out" dir="ltr" role="region" aria-label={t('out.region')}>
            {rows.length === 0 ? (
              <p className="out__empty">{isEmptyInput ? t('out.empty.nothing') : t('out.empty.invalid')}</p>
            ) : (
              <ol className="out__list">
                {shown.map((ip, i) => {
                  const catKey = CATEGORY_KEY[ip.category];
                  const key = rowKey(ip, settings.keepPort);
                  return (
                    <li
                      key={`${key}-${i}`}
                      className={classNames(
                        'out__row',
                        ip.category !== 'public' && 'is-private',
                        freshKeys.has(key) && 'is-new',
                      )}
                      style={{ ['--i' as string]: Math.min(i, 24) } as CSSProperties}
                    >
                      <span className="out__idx" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="out__ip">{ip.clean}</span>
                      <span className="out__ver">{ip.version === 6 ? t('tag.v6') : t('tag.v4')}</span>
                      <span className="out__cat">{catKey ? t(catKey) : ip.category}</span>
                      <span className="out__status">
                        {freshKeys.has(key) ? t('board.status.changed') : t('board.status.filed')}
                      </span>
                      <button
                        type="button"
                        className="rowcopy"
                        aria-label={t('action.copyRow', { ip: ip.clean })}
                        title={t('action.copyRow', { ip: ip.clean })}
                        onClick={() => void handleCopyRow(ip.clean)}
                      >
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                          <path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5v5A1.5 1.5 0 0 0 4 10h1.5" stroke="currentColor" strokeWidth="1.3" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            {rows.length > RENDER_CAP && (
              <p className="out__more">{t('out.more', { n: rows.length - RENDER_CAP })}</p>
            )}
          </div>
          <div className="pane__foot">
            <button
              type="button"
              className="btn btn--amber"
              onClick={() => void handleCopy()}
              disabled={!output}
            >
              {copied ? t('action.copied') : t('action.copyAll')}
            </button>
            <button type="button" className="btn btn--steel" onClick={handleDownload} disabled={!output}>
              {settings.outputFormat === 'json' ? t('action.downloadJson') : t('action.downloadTxt')}
            </button>
          </div>
        </div>
      </main>

      <section className="controls" aria-label={t('controls.aria')}>
        <div className="controls__row">
          <div className="ctl">
            <Toggle label={t('toggle.ipv4')} hint={t('toggle.ipv4.hint')} checked={settings.includeIpv4} onChange={v => patch('includeIpv4', v)} />
            <span className="ctl__hint">{t('toggle.ipv4.hint')}</span>
          </div>
          <div className="ctl">
            <Toggle label={t('toggle.ipv6')} hint={t('toggle.ipv6.hint')} checked={settings.includeIpv6} onChange={v => patch('includeIpv6', v)} />
            <span className="ctl__hint">{t('toggle.ipv6.hint')}</span>
          </div>
          <div className="ctl">
            <Toggle label={t('toggle.dedupe')} hint={t('toggle.dedupe.hint')} checked={settings.removeDuplicates} onChange={v => patch('removeDuplicates', v)} />
            <span className="ctl__hint">{t('toggle.dedupe.hint')}</span>
          </div>
          <div className="ctl">
            <Toggle label={t('toggle.hidePrivate')} hint={t('toggle.hidePrivate.hint')} checked={settings.excludePrivate} onChange={v => patch('excludePrivate', v)} />
            <span className="ctl__hint">{t('toggle.hidePrivate.hint')}</span>
          </div>
          <button type="button" className="link link--quiet reset" onClick={handleReset}>
            {t('action.reset')}
          </button>
        </div>
        <button
          type="button"
          className="adv-toggle"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen(v => !v)}
        >
          <span>{t('controls.advanced')}</span>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
            <path d="M3.5 6 8 10.5 12.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {advancedOpen && (
          <div className="controls__adv">
            <div className="controls__row">
              <div className="ctl">
                <Toggle label={t('toggle.keepPort')} hint={t('toggle.keepPort.hint')} checked={settings.keepPort} onChange={v => patch('keepPort', v)} />
                <span className="ctl__hint">{t('toggle.keepPort.hint')}</span>
              </div>
              <div className="ctl">
                <Toggle label={t('toggle.hideSpecial')} hint={t('toggle.hideSpecial.hint')} checked={settings.excludeSpecial} onChange={v => patch('excludeSpecial', v)} />
                <span className="ctl__hint">{t('toggle.hideSpecial.hint')}</span>
              </div>
            </div>
            <div className="controls__row controls__row--seg">
              <Segmented
                label={t('seg.order')}
                value={settings.sortMode}
                onChange={v => patch('sortMode', v)}
                options={[
                  { value: 'original', label: t('order.original') },
                  { value: 'numeric', label: t('order.numeric') },
                  { value: 'reverse', label: t('order.reverse') },
                ]}
              />
              <Segmented
                label={t('seg.cidr')}
                value={settings.cidrMode}
                onChange={v => patch('cidrMode', v)}
                options={[
                  { value: 'strip-mask', label: t('cidr.strip') },
                  { value: 'keep-mask', label: t('cidr.keep') },
                  { value: 'drop', label: t('cidr.drop') },
                ]}
              />
              <div className="seg-wrap">
                <Segmented
                  label={t('seg.format')}
                  value={settings.outputFormat}
                  onChange={v => patch('outputFormat', v)}
                  options={[
                    { value: 'newline', label: t('fmt.newline') },
                    { value: 'comma', label: t('fmt.comma') },
                    { value: 'space', label: t('fmt.space') },
                    { value: 'json', label: t('fmt.json') },
                  ]}
                />
                <p className="seg__hint">{t(FORMAT_HINT[settings.outputFormat])}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="foot">
        <span>{t('foot.privacy')}</span>
        <span className="foot__ver">{t('foot.version')}</span>
      </footer>

      {toast && (
        <div className={classNames('toast', `toast--${toast.tone}` as Tone)} role="status" key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                toast.action?.run();
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
