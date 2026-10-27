import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  extractIps,
  type CidrMode,
  type ExtractedIp,
  type OutputFormat,
  type ParseOptions,
  type ParseResult,
  type SortMode,
} from '../engine/ip-parser';

export interface Settings {
  includeIpv4: boolean;
  includeIpv6: boolean;
  removeDuplicates: boolean;
  excludePrivate: boolean;
  excludeSpecial: boolean;
  keepPort: boolean;
  sortMode: SortMode;
  cidrMode: CidrMode;
  outputFormat: OutputFormat;
}

export const DEFAULT_SETTINGS: Settings = {
  includeIpv4: true,
  includeIpv6: true,
  removeDuplicates: true,
  excludePrivate: false,
  excludeSpecial: false,
  keepPort: false,
  sortMode: 'original',
  cidrMode: 'strip-mask',
  outputFormat: 'newline',
};

const STORAGE_KEY = 'dnsqueen.settings.v1';

function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Text that is only whitespace/empty yields an empty result instead of an error. */
export const EMPTY_RESULT: ParseResult = {
  items: [],
  formattedOutput: '',
  rejected: [],
  stats: {
    totalFound: 0,
    validUnique: 0,
    duplicatesRemoved: 0,
    privateFiltered: 0,
    specialFiltered: 0,
    rejectedCount: 0,
    invalidCidrCount: 0,
    ipv4Count: 0,
    ipv6Count: 0,
    executionTimeMs: 0,
  },
};

/**
 * Applies presentation-only options (port in output) on top of the engine result,
 * so toggling them never re-runs the extraction pass.
 */
function withPorts(items: ExtractedIp[], keepPort: boolean, keepMask: boolean): ExtractedIp[] {
  const hasManualPort = items.some(i => i.port !== undefined);
  if (!keepPort || !hasManualPort) return items;
  return items.map(item => {
    if (item.port === undefined) return item;
    const host = item.version === 6 ? `[${item.baseIp}]` : item.baseIp;
    const mask = keepMask && item.cidrMask !== undefined ? `/${item.cidrMask}` : '';
    return { ...item, clean: `${host}${mask}:${item.port}` };
  });
}

function format(items: ExtractedIp[], outputFormat: OutputFormat): string {
  if (!items.length) return '';
  if (outputFormat === 'json') return JSON.stringify(items.map(i => i.clean), null, 2);
  const list = items.map(i => i.clean);
  const sep = outputFormat === 'comma' ? ', ' : outputFormat === 'space' ? ' ' : '\n';
  return list.join(sep);
}

export function useParser(source: string, settings: Settings) {
  const options = useMemo<ParseOptions>(
    () => ({
      includeIpv4: settings.includeIpv4,
      includeIpv6: settings.includeIpv6,
      removeDuplicates: settings.removeDuplicates,
      excludePrivate: settings.excludePrivate,
      excludeSpecial: settings.excludeSpecial,
      sortMode: settings.sortMode,
      cidrMode: settings.cidrMode,
      // formatting/ports are done after the fact so those toggles stay instant
      keepPort: settings.keepPort,
      outputFormat: 'newline',
    }),
    [
      settings.includeIpv4,
      settings.includeIpv6,
      settings.removeDuplicates,
      settings.excludePrivate,
      settings.excludeSpecial,
      settings.sortMode,
      settings.cidrMode,
      settings.keepPort,
    ],
  );

  const hasInput = source.trim().length > 0;

  return useMemo(() => {
    if (!hasInput) return EMPTY_RESULT;
    const result = extractIps(source, options);
    const items = withPorts(result.items, settings.keepPort, settings.cidrMode === 'keep-mask');
    return {
      items,
      formattedOutput: format(items, settings.outputFormat),
      stats: result.stats,
    };
  }, [source, options, hasInput, settings.keepPort, settings.cidrMode, settings.outputFormat]);
}

export function usePersistentSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* private mode: settings simply do not persist */
    }
  }, [settings]);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => (prev[key] === value ? prev : { ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return { settings, update, reset };
}

/** A short-lived status line ("copied", "downloaded", an error). */
export type Toast = { id: number; text: string; tone: 'ok' | 'warn' | 'error' };

export function useToast(timeout = 2600) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const push = useCallback(
    (text: string, tone: Toast['tone'] = 'ok') => {
      clear();
      counter.current += 1;
      setToast({ id: counter.current, text, tone });
      timer.current = window.setTimeout(() => setToast(null), timeout);
    },
    [clear, timeout],
  );

  useEffect(() => clear, [clear]);

  return { toast, push };
}