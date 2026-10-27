/**
 * DNSQUEEN extraction engine.
 *
 * Design notes (see README for the full contract):
 * - A single left-to-right scan produces occurrences in real input order, so
 *   ordering never depends on which address family is parsed first.
 * - Host/port/CIDR are parsed as one unit, so an IPv4-mapped IPv6 address
 *   (`::ffff:1.2.3.4`) is never split into a bogus `::ffff:192` plus `168.1.1`.
 * - CIDR prefixes are range-checked per family; an out of range prefix rejects
 *   the whole candidate and is reported, it is never stripped in silence.
 * - Classification is a closed set of categories; `Hide private` only removes
 *   private/loopback/link-local, never documentation or reserved ranges.
 */

export type SortMode = 'original' | 'numeric' | 'reverse';
/**
 * keep-mask : keep a valid prefix exactly as written (`8.8.8.8/24` -> `8.8.8.8/24`)
 * strip-mask: drop the prefix from a valid block (`8.8.8.8/24` -> `8.8.8.8`);
 *             the result is a host address, NOT the same thing as the network
 * drop      : remove every entry that carries a prefix, valid or not
 * Prefixes are never expanded into their address range.
 */
export type CidrMode = 'strip-mask' | 'keep-mask' | 'drop';
export type OutputFormat = 'newline' | 'comma' | 'json' | 'space';

export type IpCategory =
  | 'public'
  | 'private'
  | 'loopback'
  | 'linklocal'
  | 'documentation'
  | 'multicast'
  | 'reserved';

export interface ParseOptions {
  includeIpv4?: boolean;
  includeIpv6?: boolean;
  removeDuplicates?: boolean;
  /** Removes private, loopback and link-local addresses only. */
  excludePrivate?: boolean;
  /** Removes documentation, reserved and multicast ranges. */
  excludeSpecial?: boolean;
  /** Distinct endpoints: <ip>:53 and <ip>:443 stay two rows. */
  keepPort?: boolean;
  sortMode?: SortMode;
  cidrMode?: CidrMode;
  outputFormat?: OutputFormat;
}

export type RejectReason = 'cidr-prefix' | 'malformed' | 'octet-range' | 'port-range';

export interface RejectedCandidate {
  raw: string;
  reason: RejectReason;
  index: number;
}

export interface ExtractedIp {
  raw: string;               // Exactly as it appeared in the input
  clean: string;             // Canonical host, plus /prefix when keep-mask
  baseIp: string;            // Canonical host, no prefix, no port
  version: 4 | 6;
  category: IpCategory;
  isPrivate: boolean;        // true for private / loopback / link-local
  port?: number;
  cidrMask?: number;         // only a validated prefix is ever stored here
  firstIndex: number;        // Offset in the input text
  ipv4Numeric?: number;
  ipv6BigInt?: bigint;
}

export interface ParseStats {
  totalFound: number;
  validUnique: number;
  duplicatesRemoved: number;
  privateFiltered: number;
  specialFiltered: number;
  rejectedCount: number;
  invalidCidrCount: number;
  ipv4Count: number;
  ipv6Count: number;
  executionTimeMs: number;
}

export interface ParseResult {
  items: ExtractedIp[];
  formattedOutput: string;
  stats: ParseStats;
  rejected: RejectedCandidate[];
}

const CATEGORY_LABEL_KEYS: Record<IpCategory, string> = {
  public: 'public',
  private: 'private',
  loopback: 'loopback',
  linklocal: 'link-local',
  documentation: 'documentation',
  multicast: 'multicast',
  reserved: 'reserved',
};

export function categoryKey(category: IpCategory): string {
  return CATEGORY_LABEL_KEYS[category];
}

/** Categories removed by `excludePrivate` (local / non-routable on a LAN). */
export const LOCAL_CATEGORIES: ReadonlySet<IpCategory> = new Set<IpCategory>([
  'private',
  'loopback',
  'linklocal',
]);

/** Categories removed by `excludeSpecial` (documentation, reserved, multicast). */
export const SPECIAL_CATEGORIES: ReadonlySet<IpCategory> = new Set<IpCategory>([
  'documentation',
  'reserved',
  'multicast',
]);

// ---------------------------------------------------------------- IPv4 helpers

export function isValidIpv4Octet(octet: string): boolean {
  if (!/^\d{1,3}$/.test(octet)) return false;
  const value = Number(octet);
  return value >= 0 && value <= 255;
}

export function canonicalizeIpv4(ip: string): string {
  return ip.split('.').map(part => String(Number(part))).join('.');
}

export function ipv4ToNumber(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function ipv4Category(n: number): IpCategory {
  // 0.0.0.0/8 "this network"
  if ((n >>> 24) === 0) return 'reserved';
  // 10.0.0.0/8
  if ((n & 0xff000000) >>> 0 === 0x0a000000) return 'private';
  // 100.64.0.0/10 carrier grade NAT
  if ((n & 0xffc00000) >>> 0 === 0x64400000) return 'reserved';
  // 127.0.0.0/8
  if ((n & 0xff000000) >>> 0 === 0x7f000000) return 'loopback';
  // 169.254.0.0/16
  if ((n & 0xffff0000) >>> 0 === 0xa9fe0000) return 'linklocal';
  // 172.16.0.0/12
  if ((n & 0xfff00000) >>> 0 === 0xac100000) return 'private';
  // 192.0.0.0/24 IETF protocol assignments
  if ((n & 0xffffff00) >>> 0 === 0xc0000000) return 'reserved';
  // 192.0.2.0/24 TEST-NET-1
  if ((n & 0xffffff00) >>> 0 === 0xc0000200) return 'documentation';
  // 192.168.0.0/16
  if ((n & 0xffff0000) >>> 0 === 0xc0a80000) return 'private';
  // 198.18.0.0/15 benchmarking
  if ((n & 0xfffe0000) >>> 0 === 0xc6120000) return 'reserved';
  // 198.51.100.0/24 TEST-NET-2
  if ((n & 0xffffff00) >>> 0 === 0xc6336400) return 'documentation';
  // 203.0.113.0/24 TEST-NET-3
  if ((n & 0xffffff00) >>> 0 === 0xcb007100) return 'documentation';
  // 224.0.0.0/4 multicast
  if ((n & 0xf0000000) >>> 0 === 0xe0000000) return 'multicast';
  // 240.0.0.0/4 reserved + 255.255.255.255 broadcast
  if ((n & 0xf0000000) >>> 0 === 0xf0000000) return 'reserved';
  return 'public';
}

export function categorizeIpv4(ip: string): IpCategory {
  return ipv4Category(ipv4ToNumber(ip));
}

/** Kept for backwards compatibility: true only for RFC1918 / loopback / link-local. */
export function isPrivateIpv4(ip: string): boolean {
  return LOCAL_CATEGORIES.has(categorizeIpv4(ip));
}

// ---------------------------------------------------------------- IPv6 helpers

export function parseIpv6Blocks(ip: string): number[] | null {
  let clean = ip.trim();
  if (clean.startsWith('[') && clean.endsWith(']')) clean = clean.slice(1, -1);
  if (!clean) return null;

  const doubleColonCount = (clean.match(/::/g) || []).length;
  if (doubleColonCount > 1) return null;

  let leftParts: string[] = [];
  let rightParts: string[] = [];
  if (doubleColonCount === 1) {
    const [left, right] = clean.split('::');
    leftParts = left ? left.split(':') : [];
    rightParts = right ? right.split(':') : [];
  } else {
    leftParts = clean.split(':');
  }

  // Embedded IPv4 tail, e.g. ::ffff:192.168.1.1 or 64:ff9b::192.0.2.1
  const tailHolder = rightParts.length > 0 ? rightParts : leftParts;
  const lastPart = tailHolder.length > 0 ? tailHolder[tailHolder.length - 1] : '';
  if (lastPart.includes('.')) {
    const octets = lastPart.split('.');
    if (octets.length !== 4 || !octets.every(isValidIpv4Octet)) return null;
    const b0 = parseInt(octets[0], 10);
    const b1 = parseInt(octets[1], 10);
    const b2 = parseInt(octets[2], 10);
    const b3 = parseInt(octets[3], 10);
    tailHolder.pop();
    tailHolder.push(((b0 << 8) | b1).toString(16), ((b2 << 8) | b3).toString(16));
  }

  const parseGroups = (parts: string[]): number[] | null => {
    const out: number[] = [];
    for (const part of parts) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(part)) return null;
      out.push(parseInt(part, 16));
    }
    return out;
  };

  const leftNums = parseGroups(leftParts);
  const rightNums = parseGroups(rightParts);
  if (!leftNums || !rightNums) return null;

  if (doubleColonCount === 1) {
    const fill = 8 - (leftNums.length + rightNums.length);
    if (fill < 1) return null;
    return [...leftNums, ...new Array<number>(fill).fill(0), ...rightNums];
  }
  if (leftNums.length !== 8) return null;
  return leftNums;
}

function compressBlocks(blocks: number[]): string {
  // RFC 5952: longest run (>= 2) of zero groups becomes "::" (first run on ties).
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (blocks[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && blocks[j] === 0) j++;
    const len = j - i;
    if (len > bestLen && len >= 2) {
      bestStart = i;
      bestLen = len;
    }
    i = j;
  }

  const hex = blocks.map(b => b.toString(16));
  if (bestStart === -1) return hex.join(':');
  const head = hex.slice(0, bestStart).join(':');
  const tail = hex.slice(bestStart + bestLen).join(':');
  return `${head}::${tail}`;
}

function isIpv4MappedBlocks(blocks: number[]): boolean {
  return (
    blocks[0] === 0 && blocks[1] === 0 && blocks[2] === 0 && blocks[3] === 0 &&
    blocks[4] === 0 && blocks[5] === 0xffff
  );
}

export function canonicalizeIpv6FromBlocks(blocks: number[]): string {
  if (isIpv4MappedBlocks(blocks)) {
    // RFC 4291 mapped form keeps the dotted quad; that is what tools expect.
    return `::ffff:${(blocks[6] >> 8) & 0xff}.${blocks[6] & 0xff}.${(blocks[7] >> 8) & 0xff}.${blocks[7] & 0xff}`;
  }
  return compressBlocks(blocks);
}

export function canonicalizeIpv6(ip: string): string | null {
  const blocks = parseIpv6Blocks(ip);
  return blocks ? canonicalizeIpv6FromBlocks(blocks) : null;
}

export function ipv6ToBigInt(blocks: number[]): bigint {
  return blocks.reduce((acc, block) => (acc << 16n) + BigInt(block), 0n);
}

function ipv6Category(blocks: number[]): IpCategory {
  const [b0, b1] = blocks;
  const zeroPrefix = blocks.slice(0, 5).every(b => b === 0);

  // ::1 loopback, :: unspecified
  if (zeroPrefix && blocks[5] === 0 && blocks[6] === 0 && blocks[7] === 0) return 'reserved';
  if (zeroPrefix && blocks[5] === 0 && blocks[6] === 0 && blocks[7] === 1) return 'loopback';
  // ::ffff:0:0/96 IPv4-mapped: classify by the embedded IPv4 address
  if (isIpv4MappedBlocks(blocks)) {
    const v4 = `${(blocks[6] >> 8) & 0xff}.${blocks[6] & 0xff}.${(blocks[7] >> 8) & 0xff}.${blocks[7] & 0xff}`;
    return categorizeIpv4(v4);
  }
  // 64:ff9b::/96 translation
  if (b0 === 0x64 && b1 === 0xff9b) return 'reserved';
  // 2001:db8::/32 documentation
  if (b0 === 0x2001 && b1 === 0x0db8) return 'documentation';
  // 2001::/32 Teredo, 2002::/16 6to4
  if (b0 === 0x2001 && b1 === 0x0000) return 'reserved';
  if (b0 === 0x2002) return 'reserved';
  // fc00::/7 unique local
  if ((b0 & 0xfe00) === 0xfc00) return 'private';
  // fe80::/10 link-local
  if ((b0 & 0xffc0) === 0xfe80) return 'linklocal';
  // ff00::/8 multicast
  if ((b0 & 0xff00) === 0xff00) return 'multicast';
  return 'public';
}

export function categorizeIpv6(blocks: number[]): IpCategory {
  return ipv6Category(blocks);
}

export function isPrivateIpv6(blocks: number[]): boolean {
  return LOCAL_CATEGORIES.has(ipv6Category(blocks));
}

// ---------------------------------------------------------------- scanning

const HOST_CHARS = /[0-9a-fA-F:.]/;

interface Candidate {
  raw: string;
  start: number;
  end: number;
  bracketed: boolean;
}

/** Maximal runs of host-ish characters, with brackets recognised as delimiters. */
function scanCandidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  const length = text.length;
  let i = 0;

  while (i < length) {
    const startChar = text[i];
    if (startChar === '[') {
      const close = text.indexOf(']', i + 1);
      if (close > i + 1) {
        const inner = text.slice(i + 1, close);
        if (/^[0-9a-fA-F:.]+$/.test(inner) && inner.includes(':')) {
          out.push({ raw: inner, start: i + 1, end: close, bracketed: true });
          i = close + 1;
          continue;
        }
      }
      i++;
      continue;
    }

    if (!HOST_CHARS.test(startChar)) {
      i++;
      continue;
    }

    let j = i;
    while (j < length && HOST_CHARS.test(text[j])) j++;

    let raw = text.slice(i, j);
    let end = j;
    // Trailing punctuation is not part of an address ("8.8.8.8.", "2001:db8::1,").
    while (raw.length > 0 && (raw.endsWith('.') || raw.endsWith(':')) && !/^\d+\.\d+\.\d+\.\d+$/.test(raw)) {
      raw = raw.slice(0, -1);
      end--;
    }

    const prev = text[i - 1];
    const glued = prev !== undefined && /[0-9A-Za-z_.]/.test(prev);
    const minLength = raw.includes(':') ? 2 : 7;
    if (!glued && raw.length >= minLength) {
      out.push({ raw, start: i, end, bracketed: false });
    }
    i = j;
  }

  return out;
}

function readPort(text: string, from: number): { port: number; end: number } | null {
  const match = /^(?::(\d{1,5})(?!\d))/.exec(text.slice(from));
  if (!match) return null;
  const port = Number(match[1]);
  if (port < 1 || port > 65535) return null;
  return { port, end: from + match[0].length };
}

function readHashPort(text: string, from: number): { port: number; end: number } | null {
  const match = /^#(\d{1,5})(?!\d)/.exec(text.slice(from));
  if (!match) return null;
  const port = Number(match[1]);
  if (port < 1 || port > 65535) return null;
  return { port, end: from + match[0].length };
}

function readPrefix(text: string, from: number): { prefix: number; end: number } | null {
  const match = /^\/(\d{1,3})(?!\d)/.exec(text.slice(from));
  if (!match) return null;
  return { prefix: Number(match[1]), end: from + match[0].length };
}

function splitIpv4Port(raw: string): { host: string; port: number } | null {
  const idx = raw.lastIndexOf(':');
  if (idx < 0) return null;
  const host = raw.slice(0, idx);
  const portText = raw.slice(idx + 1);
  if (!/^\d{1,5}$/.test(portText)) return null;
  const octets = host.split('.');
  if (octets.length !== 4 || !octets.every(isValidIpv4Octet)) return null;
  const port = Number(portText);
  if (port < 1 || port > 65535) return null;
  return { host, port };
}

// ---------------------------------------------------------------- main entry

export function extractIps(text: string, options: ParseOptions = {}): ParseResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const {
    includeIpv4 = true,
    includeIpv6 = true,
    removeDuplicates = true,
    excludePrivate = false,
    excludeSpecial = false,
    keepPort = false,
    sortMode = 'original',
    cidrMode = 'strip-mask',
    outputFormat = 'newline',
  } = options;

  const empty = (): ParseResult => ({
    items: [],
    formattedOutput: '',
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
    rejected: [],
  });

  if (!text || !text.trim()) return empty();

  const found: ExtractedIp[] = [];
  const rejected: RejectedCandidate[] = [];
  let totalFound = 0;
  let invalidCidrCount = 0;

  const reject = (raw: string, reason: RejectReason, index: number) => {
    if (rejected.length < 100) rejected.push({ raw, reason, index });
    if (reason === 'cidr-prefix') invalidCidrCount++;
  };

  for (const candidate of scanCandidates(text)) {
    const { raw, start, end, bracketed } = candidate;
    let host = raw;
    let port: number | undefined;
    let cursor = bracketed ? end + 1 : end;

    if (bracketed) {
      const afterPort = readPort(text, cursor);
      if (afterPort) {
        port = afterPort.port;
        cursor = afterPort.end;
      }
    }

    const prefixInfo = readPrefix(text, cursor);
    let prefix = prefixInfo ? prefixInfo.prefix : undefined;
    if (prefixInfo) cursor = prefixInfo.end;

    let version: 4 | 6;
    let blocks: number[] | null = null;
    let baseIp: string;

    if (host.includes(':')) {
      const parsed = parseIpv6Blocks(host);
      if (parsed) {
        version = 6;
        blocks = parsed;
        baseIp = canonicalizeIpv6FromBlocks(parsed);
      } else {
        const ipv4WithPort = bracketed ? null : splitIpv4Port(host);
        if (ipv4WithPort) {
          version = 4;
          baseIp = canonicalizeIpv4(ipv4WithPort.host);
          port = ipv4WithPort.port;
        } else {
          // `::ffff:192` next to `.168.1.1` must never become two fake rows.
          const octets = host.split('.').filter(Boolean);
          const looksLikeBadQuad =
            octets.length === 4 && octets.every(o => /^\d{1,3}$/.test(o));
          reject(raw, looksLikeBadQuad ? 'octet-range' : 'malformed', start);
          continue;
        }
      }
    } else {
      const octets = host.split('.');
      if (octets.length !== 4) continue; // dates, versions, 3-part numbers: ignore
      if (!octets.every(isValidIpv4Octet)) {
        reject(raw, 'octet-range', start);
        continue;
      }
      version = 4;
      baseIp = canonicalizeIpv4(host);
    }

    if (!bracketed) {
      const hashPort = readHashPort(text, end);
      if (hashPort) {
        port = hashPort.port;
        cursor = Math.max(cursor, hashPort.end);
      }
    }

    const maxPrefix = version === 4 ? 32 : 128;
    if (prefix !== undefined && (prefix < 0 || prefix > maxPrefix)) {
      reject(`${raw}/${prefix}`, 'cidr-prefix', start);
      continue;
    }

    if (version === 4 && !includeIpv4) continue;
    if (version === 6 && !includeIpv6) continue;
    if (cidrMode === 'drop' && prefix !== undefined) continue;

    totalFound++;

    const category: IpCategory =
      version === 4 ? categorizeIpv4(baseIp) : ipv6Category(blocks as number[]);

    const clean = cidrMode === 'keep-mask' && prefix !== undefined ? `${baseIp}/${prefix}` : baseIp;

    found.push({
      raw: text.slice(start, cursor),
      clean,
      baseIp,
      version,
      category,
      isPrivate: LOCAL_CATEGORIES.has(category),
      port,
      cidrMask: prefix,
      firstIndex: start,
      ipv4Numeric: version === 4 ? ipv4ToNumber(baseIp) : undefined,
      ipv6BigInt: version === 6 && blocks ? ipv6ToBigInt(blocks) : undefined,
    });
  }

  // Filters keep input order; the requested sort is applied at the very end.
  let filtered = found;
  let privateFiltered = 0;
  let specialFiltered = 0;

  if (excludePrivate) {
    const before = filtered.length;
    filtered = filtered.filter(item => !LOCAL_CATEGORIES.has(item.category));
    privateFiltered = before - filtered.length;
  }
  if (excludeSpecial) {
    const before = filtered.length;
    filtered = filtered.filter(item => !SPECIAL_CATEGORIES.has(item.category));
    specialFiltered = before - filtered.length;
  }

  filtered = [...filtered].sort((a, b) => a.firstIndex - b.firstIndex);

  let uniqueItems: ExtractedIp[] = [];
  let duplicatesRemoved = 0;

  if (removeDuplicates) {
    const seen = new Set<string>();
    for (const item of filtered) {
      // Port is part of the identity only while `Keep port` is on.
      const key = [
        item.version,
        item.baseIp,
        item.cidrMask ?? '',
        keepPort ? item.port ?? '' : '',
      ].join('|');
      if (seen.has(key)) {
        duplicatesRemoved++;
        continue;
      }
      seen.add(key);
      uniqueItems.push(item);
    }
  } else {
    uniqueItems = filtered;
  }

  const byPort = (a: ExtractedIp, b: ExtractedIp) => (a.port ?? 0) - (b.port ?? 0);

  if (sortMode === 'reverse') {
    uniqueItems = [...uniqueItems].reverse();
  } else if (sortMode === 'numeric') {
    uniqueItems = [...uniqueItems].sort((a, b) => {
      if (a.version !== b.version) return a.version - b.version;
      if (a.version === 4) {
        const diff = (a.ipv4Numeric ?? 0) - (b.ipv4Numeric ?? 0);
        return diff !== 0 ? diff : byPort(a, b);
      }
      const left = a.ipv6BigInt ?? 0n;
      const right = b.ipv6BigInt ?? 0n;
      if (left < right) return -1;
      if (left > right) return 1;
      return byPort(a, b);
    });
  }

  const cleanList = uniqueItems.map(i => i.clean);
  let formattedOutput: string;
  switch (outputFormat) {
    case 'comma':
      formattedOutput = cleanList.join(', ');
      break;
    case 'space':
      formattedOutput = cleanList.join(' ');
      break;
    case 'json':
      formattedOutput = JSON.stringify(cleanList, null, 2);
      break;
    case 'newline':
    default:
      formattedOutput = cleanList.join('\n');
      break;
  }

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    items: uniqueItems,
    formattedOutput,
    stats: {
      totalFound,
      validUnique: uniqueItems.length,
      duplicatesRemoved,
      privateFiltered,
      specialFiltered,
      rejectedCount: rejected.length,
      invalidCidrCount,
      ipv4Count: uniqueItems.filter(i => i.version === 4).length,
      ipv6Count: uniqueItems.filter(i => i.version === 6).length,
      executionTimeMs: Math.round((endTime - startTime) * 10) / 10,
    },
    rejected,
  };
}

/**
 * Render one endpoint for display/copy.
 * IPv6 hosts are bracketed only when a port or prefix is attached.
 */
export function formatEndpoint(
  item: ExtractedIp,
  options: { keepPort: boolean; keepMask: boolean },
): string {
  const mask = options.keepMask && item.cidrMask !== undefined ? `/${item.cidrMask}` : '';
  if (!options.keepPort || item.port === undefined) {
    return item.version === 6 && mask ? `[${item.baseIp}]${mask}` : `${item.baseIp}${mask}`;
  }
  return item.version === 6
    ? `[${item.baseIp}]${mask}:${item.port}`
    : `${item.baseIp}${mask}:${item.port}`;
}