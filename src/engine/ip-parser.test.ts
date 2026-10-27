import { describe, it, expect } from 'vitest';
import { extractIps, canonicalizeIpv6, isPrivateIpv4 } from './ip-parser';

describe('extractIps — core extraction', () => {
  it('extracts plain IPv4 list vertically', () => {
    const r = extractIps('8.8.8.8\n1.1.1.1\n9.9.9.9');
    expect(r.formattedOutput).toBe('8.8.8.8\n1.1.1.1\n9.9.9.9');
    expect(r.stats.validUnique).toBe(3);
  });

  it('strips ports from IPv4 (colon and hash separators)', () => {
    const r = extractIps('1.2.3.4:443\n5.6.7.8#53\n9.9.9.9: 80');
    expect(r.items.map(i => i.clean)).toEqual(['1.2.3.4', '5.6.7.8', '9.9.9.9']);
    expect(r.items[0].port).toBe(443);
    expect(r.items[1].port).toBe(53);
  });

  it('handles bracketed IPv6 with port', () => {
    const r = extractIps('[2001:db8::1]:8080');
    expect(r.items.length).toBe(1);
    expect(r.items[0].clean).toBe('2001:db8::1');
    expect(r.items[0].version).toBe(6);
    expect(r.items[0].port).toBe(8080);
  });

  it('handles bracketed IPv6 without port and with CIDR', () => {
    const r = extractIps('[2001:db8::]/64', { cidrMode: 'keep-mask' });
    expect(r.items[0].clean).toBe('2001:db8::/64');
    const r2 = extractIps('[2001:db8::]/64', { cidrMode: 'strip-mask' });
    expect(r2.items[0].clean).toBe('2001:db8::');
  });

  it('deduplicates same IP written differently', () => {
    const r = extractIps('8.8.8.8\n8.8.8.8:53\n008.008.008.008\n[::1]:80\n::1');
    expect(r.stats.validUnique).toBe(2);
    expect(r.stats.duplicatesRemoved).toBe(3);
    const cleans = r.items.map(i => i.clean);
    expect(cleans).toContain('8.8.8.8');
    expect(cleans).toContain('::1');
  });

  it('deduplicates compressed vs expanded IPv6', () => {
    const r = extractIps('2001:0db8:0000:0000:0000:0000:0000:0001\n2001:db8::1');
    expect(r.stats.validUnique).toBe(1);
    expect(r.items[0].clean).toBe('2001:db8::1');
  });

  it('preserves original order by default', () => {
    const r = extractIps('9.9.9.9\n1.1.1.1\n5.5.5.5');
    expect(r.items.map(i => i.clean)).toEqual(['9.9.9.9', '1.1.1.1', '5.5.5.5']);
  });

  it('reverse order keeps original positions reversed', () => {
    const r = extractIps('9.9.9.9\n1.1.1.1\n5.5.5.5', { sortMode: 'reverse' });
    expect(r.items.map(i => i.clean)).toEqual(['5.5.5.5', '1.1.1.1', '9.9.9.9']);
  });

  it('numeric sort orders IPv4 by value, not string', () => {
    const r = extractIps('192.168.1.1\n9.9.9.9\n1.2.3.4\n11.0.0.1', { sortMode: 'numeric' });
    expect(r.items.map(i => i.clean)).toEqual(['1.2.3.4', '9.9.9.9', '11.0.0.1', '192.168.1.1']);
  });

  it('numeric sort puts IPv4 before IPv6', () => {
    const r = extractIps('fe80::1\n8.8.8.8', { sortMode: 'numeric' });
    expect(r.items.map(i => i.version)).toEqual([4, 6]);
  });

  it('excludes private/loopback/link-local IPv4 when enabled', () => {
    const r = extractIps('10.0.0.1\n8.8.8.8\n192.168.0.5\n172.16.3.4\n127.0.0.1\n169.254.1.1\n1.1.1.1', { excludePrivate: true });
    expect(r.items.map(i => i.clean)).toEqual(['8.8.8.8', '1.1.1.1']);
    expect(r.stats.privateFiltered).toBe(5);
  });

  it('excludes private IPv6 (ULA, loopback, link-local)', () => {
    const r = extractIps('fd00::1\n::1\nfe80::1\n2606:4700:4700::1111', { excludePrivate: true });
    expect(r.items.map(i => i.clean)).toEqual(['2606:4700:4700::1111']);
  });

  it('extracts IPs from mixed text and URLs', () => {
    const text = `Resolvers list:
      Cloudflare 1.1.1.1:53 (https://one.one.one.one)
      Google dns.google 8.8.8.8
      url http://9.9.9.9/dns-query?name=test
      ping to 4.2.2.1 done`;
    const r = extractIps(text);
    expect(r.items.map(i => i.clean)).toEqual(['1.1.1.1', '8.8.8.8', '9.9.9.9', '4.2.2.1']);
  });

  it('ignores dates, version numbers and unrelated dotted numbers', () => {
    const text = `released 2024.10.27, version v1.2.3.4, file 10.20.30.40.5, build 2024.10.27.1, tcp 1.5`;
    const r = extractIps(text);
    expect(r.items.map(i => i.clean)).toEqual([]);
  });

  it('handles CIDR with strip, keep and drop modes', () => {
    const text = '10.1.2.0/24 8.8.8.8/32 192.168.0.0/16';
    expect(extractIps(text, { cidrMode: 'strip-mask' }).items.map(i => i.clean))
      .toEqual(['10.1.2.0', '8.8.8.8', '192.168.0.0']);
    expect(extractIps(text, { cidrMode: 'keep-mask' }).items.map(i => i.clean))
      .toEqual(['10.1.2.0/24', '8.8.8.8/32', '192.168.0.0/16']);
    expect(extractIps(text, { cidrMode: 'drop' }).items.map(i => i.clean))
      .toEqual([]);
  });

  it('skips ambiguous / malformed strings', () => {
    const text = '999.1.1.1\n1.2.3\n1.2.3.4.5\n8.8.8.8.\nabc.def.ghi.jkl\n1.2.3.4000:80';
    const r = extractIps(text);
    expect(r.items.map(i => i.clean)).toEqual(['8.8.8.8']);
  });

  it('does not extract version strings like v1.2.3.4', () => {
    const r = extractIps('app v1.2.3.4 and 1.2.3.4 real');
    expect(r.items.map(i => i.clean)).toEqual(['1.2.3.4']);
    expect(r.stats.totalFound).toBe(1);
  });

  it('returns empty result for empty input', () => {
    const r = extractIps('');
    expect(r.items).toEqual([]);
    expect(r.formattedOutput).toBe('');
    expect(r.stats.totalFound).toBe(0);
  });

  it('returns empty result for whitespace-only input', () => {
    const r = extractIps('   \n\t  \n');
    expect(r.items).toEqual([]);
  });

  it('handles very large inputs (5000 IPs)', () => {
    const lines: string[] = [];
    for (let i = 0; i < 5000; i++) {
      lines.push(`10.${Math.floor(i / 256)}.${i % 256}.1:443`);
    }
    const r = extractIps(lines.join('\n'));
    expect(r.stats.validUnique).toBe(5000);
  });

  it('output formats: comma, json, space', () => {
    const input = '1.1.1.1\n8.8.8.8';
    expect(extractIps(input, { outputFormat: 'comma' }).formattedOutput).toBe('1.1.1.1, 8.8.8.8');
    expect(extractIps(input, { outputFormat: 'space' }).formattedOutput).toBe('1.1.1.1 8.8.8.8');
    expect(extractIps(input, { outputFormat: 'json' }).formattedOutput).toBe(JSON.stringify(['1.1.1.1', '8.8.8.8'], null, 2));
  });

  it('can disable IPv4 or IPv6', () => {
    expect(extractIps('1.1.1.1 ::1', { includeIpv6: false }).items.map(i => i.clean)).toEqual(['1.1.1.1']);
    expect(extractIps('1.1.1.1 ::1', { includeIpv4: false }).items.map(i => i.clean)).toEqual(['::1']);
  });

  it('keeps duplicates when dedup disabled', () => {
    const r = extractIps('8.8.8.8\n8.8.8.8', { removeDuplicates: false });
    expect(r.stats.validUnique).toBe(2);
  });
});

describe('canonicalizeIpv6', () => {
  it('compresses longest zero run', () => {
    expect(canonicalizeIpv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
    expect(canonicalizeIpv6('0000:0000:0000:0000:0000:0000:0000:0001')).toBe('::1');
    expect(canonicalizeIpv6('::')).toBe('::');
  });
  it('rejects invalid', () => {
    expect(canonicalizeIpv6('12345::1')).toBeNull();
    expect(canonicalizeIpv6('1::2::3')).toBeNull();
    expect(canonicalizeIpv6('gggg::1')).toBeNull();
  });
});

describe('isPrivateIpv4', () => {
  it('classifies ranges', () => {
    expect(isPrivateIpv4('10.1.2.3')).toBe(true);
    expect(isPrivateIpv4('172.20.1.1')).toBe(true);
    expect(isPrivateIpv4('172.32.0.1')).toBe(false);
    expect(isPrivateIpv4('192.168.1.1')).toBe(true);
    expect(isPrivateIpv4('8.8.8.8')).toBe(false);
  });
});
