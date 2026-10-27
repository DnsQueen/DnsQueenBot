import { describe, it, expect } from 'vitest';
import { extractIps, formatEndpoint, type ParseOptions } from './ip-parser';

const show = (text: string, o: ParseOptions = {}) => extractIps(text, o).items.map(i => i.clean);
const one = (text: string, o?: ParseOptions) => show(text, o);

describe('BUG 2 — IPv4-mapped IPv6 is one address, never split', () => {
  it('::ffff:192.168.1.1 stays whole and is classified private', () => {
    const r = extractIps('::ffff:192.168.1.1');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].baseIp).toBe('::ffff:192.168.1.1');
    expect(r.items[0].version).toBe(6);
    expect(r.items[0].category).toBe('private');
    expect(r.items.map(i => i.clean)).not.toContain('192.168.1.1');
    expect(r.items[0].clean).not.toMatch(/::ffff:192$/);
  });
  it('::ffff:8.8.8.8 is public and keeps the dotted quad', () => {
    const r = extractIps('::ffff:8.8.8.8');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].baseIp).toBe('::ffff:8.8.8.8');
    expect(r.items[0].category).toBe('public');
  });
  it('[::ffff:192.168.1.1]:443 keeps the port and a valid host', () => {
    const r = extractIps('[::ffff:192.168.1.1]:443', { keepPort: true });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].port).toBe(443);
    expect(formatEndpoint(r.items[0], { keepPort: true, keepMask: false })).toBe('[::ffff:192.168.1.1]:443');
  });
  it('never emits a truncated IPv6 fragment from a mapped input', () => {
    for (const input of ['::ffff:192.168.1.1', '::ffff:8.8.8.8', '[::ffff:192.168.1.1]:443']) {
      for (const item of extractIps(input).items) {
        expect(item.baseIp.endsWith(':192') && item.baseIp !== '::ffff:192.168.1.1').toBe(false);
      }
    }
  });
});

describe('BUG 3 — CIDR prefix validation (0-32 / 0-128)', () => {
  it('rejects 8.8.8.8/99 and does not silently strip the prefix', () => {
    const r = extractIps('8.8.8.8/99');
    expect(r.items).toHaveLength(0);
    expect(r.stats.invalidCidrCount).toBe(1);
    expect(r.rejected[0].reason).toBe('cidr-prefix');
    expect(r.rejected[0].raw).toContain('/99');
  });
  it('rejects 2001:db8::1/129', () => {
    const r = extractIps('2001:db8::1/129');
    expect(r.items).toHaveLength(0);
    expect(r.stats.invalidCidrCount).toBe(1);
  });
  it('accepts the edges of both ranges', () => {
    expect(one('8.8.8.8/32', { cidrMode: 'keep-mask' })).toEqual(['8.8.8.8/32']);
    expect(one('8.8.8.8/0', { cidrMode: 'keep-mask' })).toEqual(['8.8.8.8/0']);
    expect(one('2001:db8::1/128', { cidrMode: 'keep-mask' })).toEqual(['2001:db8::1/128']);
    expect(one('2001:db8::1/0', { cidrMode: 'keep-mask' })).toEqual(['2001:db8::1/0']);
  });
  it('keep mode preserves a valid prefix', () => {
    expect(one('192.0.2.0/24', { cidrMode: 'keep-mask' })).toEqual(['192.0.2.0/24']);
    expect(one('[2001:db8::]/32', { cidrMode: 'keep-mask' })).toEqual(['2001:db8::/32']);
  });
  it('strip mode removes the prefix from a valid block', () => {
    expect(one('192.0.2.0/24', { cidrMode: 'strip-mask' })).toEqual(['192.0.2.0']);
  });
  it('drop mode removes CIDR rows only', () => {
    expect(one('192.0.2.0/24 8.8.8.8', { cidrMode: 'drop' })).toEqual(['8.8.8.8']);
  });
  it('never expands a block into single addresses', () => {
    const r = extractIps('10.0.0.0/8', { cidrMode: 'keep-mask' });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].clean).toBe('10.0.0.0/8');
  });
});

describe('BUG 4 — input order and dedupe', () => {
  it('keeps the real first occurrence of two spellings of one address', () => {
    const r = extractIps('2001:db8::1 then later [2001:0db8:0:0:0:0:0:1]');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].firstIndex).toBe(0);
    expect(r.items[0].clean).toBe('2001:db8::1');
    expect(r.stats.duplicatesRemoved).toBe(1);
  });
  it('interleaves both families in original order', () => {
    const r = extractIps('9.9.9.9 2001:db8::5 8.8.8.8 2001:db8::2');
    expect(r.items.map(i => i.baseIp)).toEqual(['9.9.9.9', '2001:db8::5', '8.8.8.8', '2001:db8::2']);
  });
  it('compressed, full and bracketed duplicates collapse to the first', () => {
    const r = extractIps('[2001:db8::1]:53 2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(r.items).toHaveLength(1);
    expect(r.stats.duplicatesRemoved).toBe(1);
  });
  it('dedupe off keeps every occurrence', () => {
    expect(extractIps('8.8.8.8 8.8.8.8', { removeDuplicates: false }).items).toHaveLength(2);
  });
  it('distinct ports are distinct endpoints only while Keep port is on', () => {
    const a = extractIps('1.1.1.1:53 1.1.1.1:443', { keepPort: false });
    expect(a.items).toHaveLength(1);
    expect(a.items[0].port).toBe(53);
    const b = extractIps('1.1.1.1:53 1.1.1.1:443', { keepPort: true });
    expect(b.items).toHaveLength(2);
    expect(b.items.map(i => formatEndpoint(i, { keepPort: true, keepMask: false }))).toEqual([
      '1.1.1.1:53',
      '1.1.1.1:443',
    ]);
    const c = extractIps('[2001:db8::1]:53 [2001:db8::1]:5353', { keepPort: true });
    expect(c.items).toHaveLength(2);
  });
  it('numeric sort is numeric, not textual', () => {
    expect(one('192.168.9.1 9.9.9.9 8.8.8.8', { sortMode: 'numeric', excludePrivate: false }))
      .toEqual(['8.8.8.8', '9.9.9.9', '192.168.9.1']);
  });
  it('reverse sort flips the original order', () => {
    expect(one('8.8.8.8 9.9.9.9', { sortMode: 'reverse' })).toEqual(['9.9.9.9', '8.8.8.8']);
  });
});

describe('BUG 5 — classification is exact, Hide private is not Hide everything', () => {
  it('203.0.113.14 is documentation, not private', () => {
    const r = extractIps('203.0.113.14');
    expect(r.items[0].category).toBe('documentation');
    expect(r.items[0].isPrivate).toBe(false);
  });
  it('Hide private keeps documentation, reserved and multicast', () => {
    const input = '10.0.0.1 127.0.0.1 169.254.1.1 203.0.113.14 240.0.0.1 224.0.0.1 8.8.8.8';
    const kept = extractIps(input, { excludePrivate: true }).items.map(i => i.baseIp);
    expect(kept).toEqual(['203.0.113.14', '240.0.0.1', '224.0.0.1', '8.8.8.8']);
  });
  it('IPv4 categories', () => {
    const cat = (ip: string) => extractIps(ip).items[0].category;
    expect(cat('10.1.2.3')).toBe('private');
    expect(cat('172.20.1.1')).toBe('private');
    expect(cat('172.32.0.1')).toBe('public');
    expect(cat('192.168.1.1')).toBe('private');
    expect(cat('127.0.0.1')).toBe('loopback');
    expect(cat('169.254.10.1')).toBe('linklocal');
    expect(cat('198.51.100.7')).toBe('documentation');
    expect(cat('192.0.2.5')).toBe('documentation');
    expect(cat('224.0.0.251')).toBe('multicast');
    expect(cat('240.0.0.1')).toBe('reserved');
    expect(cat('100.64.0.1')).toBe('reserved');
    expect(cat('8.8.8.8')).toBe('public');
  });
  it('IPv6 categories', () => {
    const cat = (ip: string) => extractIps(ip).items[0].category;
    expect(cat('fd00::1')).toBe('private');
    expect(cat('fe80::1')).toBe('linklocal');
    expect(cat('::1')).toBe('loopback');
    expect(cat('2001:db8::9')).toBe('documentation');
    expect(cat('ff02::1')).toBe('multicast');
    expect(cat('2001:4860:4860::8888')).toBe('public');
  });
  it('excludeSpecial removes only special-use ranges', () => {
    const kept = extractIps('203.0.113.14 224.0.0.1 10.0.0.1 8.8.8.8', { excludeSpecial: true })
      .items.map(i => i.baseIp);
    expect(kept).toEqual(['10.0.0.1', '8.8.8.8']);
  });
});

describe('regressions from the earlier round', () => {
  it('strips ports from IPv4 with : and # separators', () => {
    expect(one('1.2.3.4:443\n5.6.7.8#53\n9.9.9.9: 80')).toEqual(['1.2.3.4', '5.6.7.8', '9.9.9.9']);
  });
  it('ignores dates, versions and URLs while reading the real address', () => {
    expect(one('2024.10.27 v1.2.3.4 https://dns.example.com/8.8.8.8 x8.8.8.8')).toEqual(['8.8.8.8']);
  });
  it('rejects ambiguous octets and five-part numbers', () => {
    expect(extractIps('999.1.1.1 1.2.3.4.5').items).toHaveLength(0);
  });
  it('empty input yields an empty result', () => {
    expect(extractIps('').items).toHaveLength(0);
    expect(extractIps('   \n ').formattedOutput).toBe('');
  });
  it('output formats', () => {
    const text = '8.8.8.8\n9.9.9.9';
    expect(extractIps(text, { outputFormat: 'comma' }).formattedOutput).toBe('8.8.8.8, 9.9.9.9');
    expect(extractIps(text, { outputFormat: 'newline' }).formattedOutput).toBe('8.8.8.8\n9.9.9.9');
    expect(JSON.parse(extractIps(text, { outputFormat: 'json' }).formattedOutput)).toEqual(['8.8.8.8', '9.9.9.9']);
  });
  it('family toggles', () => {
    expect(one('8.8.8.8 2001:4860:4860::8888', { includeIpv6: false })).toEqual(['8.8.8.8']);
    expect(one('8.8.8.8 2001:4860:4860::8888', { includeIpv4: false })).toEqual(['2001:4860:4860::8888']);
  });
});
