import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import './App.css';
import { useParser, usePersistentSettings, useToast, type Settings } from './hooks/useParser';
import { usePreferences } from './hooks/usePreferences';
import { copyText, CopyError, downloadText, txtFilename } from './lib/clipboard';
import { haptic, setTelegramChrome } from './lib/telegram';
import { locale, type TranslationKey } from './i18n/translations';

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

export default function App() {
  const [source, setSource] = useState('');
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
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

  const ingestFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_BYTES) {
        push(t('toast.fileTooBig', { size: (file.size / 1_000_000).toFixed(1) }), 'error');
        return;
      }
      setBusyFile(file.name);
      try {
        const text = await file.text();
        if (!text.trim()) {
          push(t('toast.fileEmpty'), 'warn');
          setSource('');
          return;
        }
        setSource(text);
        push(t('toast.fileLoaded', { name: file.name }));
      } catch {
        push(t('toast.fileUnreadable'), 'error');
      } finally {
        setBusyFile(null);
      }
    },
    [push, t],
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

  const handleDownload = useCallback(() => {
    if (!output) {
      push(t('toast.nothingToDownload'), 'warn');
      return;
    }
    const ext = settings.outputFormat === 'json' ? 'json' : 'txt';
    const name = txtFilename('dnsqueen').replace(/\.txt$/, `.${ext}`);
    downloadText(name, output, false);
    push(t('toast.saved', { name }));
  }, [output, settings.outputFormat, push, t]);

  const patch = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => update(key, value),
    [update],
  );

  const handleReset = useCallback(() => {
    reset();
    push(t('toast.reset'));
  }, [reset, push, t]);

  const shown = rows.slice(0, RENDER_CAP);
  const isEmptyInput = !source.trim();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
              <path d="M16 2.5 29 9.6v12.8L16 29.5 3 22.4V9.6z" stroke="currentColor" strokeWidth="1.4" />
              <path
                d="M16 8v16M8.4 12.2l15.2 7.6M23.6 12.2 8.4 19.8"
                stroke="currentColor"
                strokeWidth="1.1"
                opacity=".55"
              />
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

        <div className="meter" aria-live="polite">
          <span className="meter__n">{rows.length}</span>
          <span className="meter__u">{t('meter.unique')}</span>
          <span className="meter__sep" aria-hidden="true" />
          <span className="meter__sub">{result.stats.executionTimeMs.toFixed(1)} ms</span>
        </div>
      </header>

      <section className="strip" aria-label={t('summary.aria')}>
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
          <span>{t('strip.privateRemoved')}</span>
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
      {result.stats.invalidCidrCount > 0 && (
        <p className="strip__note">{t('strip.invalidCidr', { n: result.stats.invalidCidrCount })}</p>
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
              <button type="button" className="link" onClick={() => setSource(SAMPLE)}>
                {t('action.sample')}
              </button>
              <button
                type="button"
                className="link link--quiet"
                onClick={() => setSource('')}
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
            <div className="pane__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void handleCopy()}
                disabled={!output}
              >
                {copied ? t('action.copied') : t('action.copyAll')}
              </button>
              <button type="button" className="link" onClick={handleDownload}>
                {t('action.downloadTxt')}
              </button>
            </div>
          </div>
          <div className="out" dir="ltr" role="region" aria-label={t('out.region')}>
            {rows.length === 0 ? (
              <p className="out__empty">{isEmptyInput ? t('out.empty.nothing') : t('out.empty.invalid')}</p>
            ) : (
              <ol className="out__list">
                {shown.map((ip, i) => {
                  const catKey = CATEGORY_KEY[ip.category];
                  return (
                    <li
                      key={`${ip.baseIp}-${ip.port ?? 0}-${i}`}
                      className={classNames('out__row', ip.category !== 'public' && 'is-private')}
                      style={{ ['--i' as string]: Math.min(i, 24) } as CSSProperties}
                    >
                      <span className="out__idx" aria-hidden="true">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="out__ip">{ip.clean}</span>
                      <span className="out__tag">
                        {ip.version === 6 ? t('tag.v6') : t('tag.v4')}
                        {ip.category !== 'public' && catKey ? ` · ${t(catKey)}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            {rows.length > RENDER_CAP && (
              <p className="out__more">{t('out.more', { n: rows.length - RENDER_CAP })}</p>
            )}
          </div>
        </div>
      </main>

      <section className="controls" aria-label={t('controls.aria')}>
        <div className="controls__row">
          <Toggle label={t('toggle.ipv4')} hint={t('toggle.ipv4.hint')} checked={settings.includeIpv4} onChange={v => patch('includeIpv4', v)} />
          <Toggle label={t('toggle.ipv6')} hint={t('toggle.ipv6.hint')} checked={settings.includeIpv6} onChange={v => patch('includeIpv6', v)} />
          <Toggle label={t('toggle.dedupe')} hint={t('toggle.dedupe.hint')} checked={settings.removeDuplicates} onChange={v => patch('removeDuplicates', v)} />
          <Toggle label={t('toggle.keepPort')} hint={t('toggle.keepPort.hint')} checked={settings.keepPort} onChange={v => patch('keepPort', v)} />
          <Toggle label={t('toggle.hidePrivate')} hint={t('toggle.hidePrivate.hint')} checked={settings.excludePrivate} onChange={v => patch('excludePrivate', v)} />
          <Toggle label={t('toggle.hideSpecial')} hint={t('toggle.hideSpecial.hint')} checked={settings.excludeSpecial} onChange={v => patch('excludeSpecial', v)} />
          <button type="button" className="link link--quiet reset" onClick={handleReset}>
            {t('action.reset')}
          </button>
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
        </div>
      </section>

      <footer className="foot">
        <span>{t('foot.privacy')}</span>
        <span className="foot__ver">{t('foot.version')}</span>
      </footer>

      {toast && (
        <div className={classNames('toast', `toast--${toast.tone}` as Tone)} role="status" key={toast.id}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
