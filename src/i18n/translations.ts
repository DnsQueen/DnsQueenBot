/**
 * DNSQUEEN — single source of truth for every visible string.
 *
 * Rules:
 * - `fa` is the reference dictionary; its keys define TranslationKey, so a key
 *   added there is a TypeScript error in `en` until it is translated.
 * - Only UI chrome lives here. Addresses, ports, CIDR prefixes, user input and
 *   exported files are data and are never touched by the language layer.
 * - Placeholders use {name} and are substituted by `t()`; no string surgery
 *   happens anywhere else.
 */

export type Lang = 'fa' | 'en';

const fa = {
  'app.name': 'DNSQUEEN',
  'app.tagline': 'ریزالورها، آدرس‌ها و بلوک‌های CIDR — یک آدرس تمیز در هر خط.',

  'nav.lang': 'تغییر زبان',
  'nav.theme': 'تغییر تم روشن و تاریک',
  'nav.theme.toLight': 'روشن',
  'nav.theme.toDark': 'تاریک',

  'meter.unique': 'یکتا',

  'summary.aria': 'خلاصهٔ پردازش',
  'strip.found': 'پیداشده',
  'strip.duplicates': 'تکراری',
  'strip.privateRemoved': 'خصوصی حذف‌شده',
  'strip.v4v6': 'v4 / v6',
  'strip.invalidCidr': '{n} پیشوند CIDR نامعتبر رد شد',

  'pane.source': 'ورودی',
  'pane.output': 'خروجی',
  'pane.lines': '{n} خط',

  'action.openTxt': 'باز کردن .txt',
  'action.reading': 'در حال خواندن…',
  'action.sample': 'نمونه',
  'action.clear': 'پاک کردن',
  'action.copyAll': 'کپی همه',
  'action.copied': 'کپی شد ✓',
  'action.downloadTxt': 'دریافت TXT',
  'action.reset': 'بازنشانی',

  'input.aria': 'متنی که آدرس‌ها از آن استخراج می‌شوند',
  'input.placeholder':
    'ریزالورها، جفت‌های IP:port، IPv6 داخل براکت، URL یا یک لاگ کامل را اینجا پیست کن.\n\n203.0.113.14\n8.8.8.8:53\n[2001:db8::1]:853\n\n…یا یک فایل .txt را داخل این کادر رها کن',
  'input.dropHint': 'فایل .txt یا .csv را اینجا رها کن',

  'out.empty.nothing':
    'هنوز چیزی برای پاک‌سازی نیست. هر چه وارد کنی روی همین دستگاه می‌ماند و به هیچ سروری فرستاده نمی‌شود.',
  'out.empty.invalid':
    'آدرس معتبری در این متن پیدا نشد. غلط‌هایی مثل 999.1.1.1 یا 1.2.3.4.5 را بررسی کن، یا فیلترها را بازتر کن.',
  'out.more': '{n} ردیف دیگر — کپی و دانلود همهٔ ردیف‌ها را می‌دهد',
  'out.region': 'آدرس‌های استخراج‌شده',

  'tag.v4': 'v4',
  'tag.v6': 'v6',

  'cat.public': 'عمومی',
  'cat.private': 'خصوصی',
  'cat.loopback': 'لوپ‌بک',
  'cat.linklocal': 'link-local',
  'cat.documentation': 'مستندسازی',
  'cat.multicast': 'چندپخشی',
  'cat.reserved': 'رزروشده',

  'toggle.ipv4': 'IPv4',
  'toggle.ipv4.hint': 'آدرس‌های IPv4 در خروجی بمانند',
  'toggle.ipv6': 'IPv6',
  'toggle.ipv6.hint': 'آدرس‌های IPv6 در خروجی بمانند',
  'toggle.dedupe': 'حذف تکراری',
  'toggle.dedupe.hint': 'آدرس تکراری را حذف کن، حتی اگر متفاوت نوشته شده باشد',
  'toggle.keepPort': 'نگه‌داشتن پورت',
  'toggle.keepPort.hint': 'پورت را در خروجی بنویس (ip:port و ip:portٔ دیگر دو ردیف جدا می‌شوند)',
  'toggle.hidePrivate': 'حذف خصوصی',
  'toggle.hidePrivate.hint': 'آدرس‌های خصوصی، لوپ‌بک و link-local حذف شوند',
  'toggle.hideSpecial': 'حذف ویژه',
  'toggle.hideSpecial.hint': 'محدوده‌های مستندسازی، رزروشده و چندپخشی هم حذف شوند',

  'seg.order': 'ترتیب',
  'order.original': 'همان‌طور که نوشته شده',
  'order.numeric': 'عددی',
  'order.reverse': 'برعکس',
  'seg.cidr': 'CIDR',
  'cidr.strip': 'حذف پیشوند',
  'cidr.keep': 'نگه‌داشتن',
  'cidr.drop': 'حذف بلوک',
  'seg.format': 'قالب خروجی',
  'fmt.newline': 'خط‌به‌خط',
  'fmt.comma': 'با کاما',
  'fmt.space': 'با فاصله',
  'fmt.json': 'JSON',
  'format.hint.newline': 'یک آدرس در هر خط',

  'controls.aria': 'تنظیمات پردازش',

  'foot.privacy': 'همه‌چیز در مرورگر تو اجرا می‌شود — بدون آپلود، بدون ردیابی',
  'foot.version': 'v1.1',

  'toast.copied': 'در کلیپ‌بورد کپی شد',
  'toast.copyEmpty': 'چیزی برای کپی نیست.',
  'toast.copyBlocked': 'مرورگر اجازهٔ کپی نداد. متن را انتخاب و دستی کپی کن.',
  'toast.copyFailed': 'کپی در این مرورگر انجام نشد.',
  'toast.saved': 'ذخیره شد: {name}',
  'toast.nothingToDownload': 'هنوز چیزی برای دانلود نیست.',
  'toast.fileTooBig': 'حجم فایل {size} مگابایت است — سقف ۲ مگابایت. متن را مستقیم پیست کن.',
  'toast.fileEmpty': 'این فایل خالی است — چیزی برای استخراج نیست.',
  'toast.fileUnreadable': 'فایل خوانده نشد. متن را مستقیم پیست کن.',
  'toast.fileLoaded': 'بارگذاری شد: {name}',
  'toast.reset': 'تنظیمات به حالت اولیه برگشت',
} as const;

export type TranslationKey = keyof typeof fa;

const en: Record<TranslationKey, string> = {
  'app.name': 'DNSQUEEN',
  'app.tagline': 'Resolvers, addresses and CIDR blocks — cleaned into one address per line.',

  'nav.lang': 'Switch language',
  'nav.theme': 'Switch between light and dark theme',
  'nav.theme.toLight': 'Light',
  'nav.theme.toDark': 'Dark',

  'meter.unique': 'unique',

  'summary.aria': 'Processing summary',
  'strip.found': 'found',
  'strip.duplicates': 'duplicates',
  'strip.privateRemoved': 'private removed',
  'strip.v4v6': 'v4 / v6',
  'strip.invalidCidr': '{n} invalid CIDR prefix rejected',

  'pane.source': 'Source',
  'pane.output': 'Output',
  'pane.lines': '{n} lines',

  'action.openTxt': 'open .txt',
  'action.reading': 'reading…',
  'action.sample': 'sample',
  'action.clear': 'clear',
  'action.copyAll': 'Copy all',
  'action.copied': 'Copied ✓',
  'action.downloadTxt': 'Download TXT',
  'action.reset': 'reset',

  'input.aria': 'Raw text to extract addresses from',
  'input.placeholder':
    'Paste resolvers, IP:port pairs, IPv6 in brackets, URLs, or a whole log.\n\n203.0.113.14\n8.8.8.8:53\n[2001:db8::1]:853\n\n…or drop a .txt file here',
  'input.dropHint': 'drop a .txt or .csv file',

  'out.empty.nothing': 'Nothing to clean yet. Everything you paste stays on this device — no request is sent.',
  'out.empty.invalid':
    'No valid address in that text. Check for typos such as 999.1.1.1 or 1.2.3.4.5, or loosen the filters above.',
  'out.more': '{n} more rows — copy and download use all of them',
  'out.region': 'Extracted addresses',

  'tag.v4': 'v4',
  'tag.v6': 'v6',

  'cat.public': 'public',
  'cat.private': 'private',
  'cat.loopback': 'loopback',
  'cat.linklocal': 'link-local',
  'cat.documentation': 'documentation',
  'cat.multicast': 'multicast',
  'cat.reserved': 'reserved',

  'toggle.ipv4': 'IPv4',
  'toggle.ipv4.hint': 'Keep IPv4 addresses',
  'toggle.ipv6': 'IPv6',
  'toggle.ipv6.hint': 'Keep IPv6 addresses',
  'toggle.dedupe': 'Dedupe',
  'toggle.dedupe.hint': 'Remove duplicate addresses, even when written differently',
  'toggle.keepPort': 'Keep port',
  'toggle.keepPort.hint': 'Write the port into the output (ip:53 and ip:443 stay two rows)',
  'toggle.hidePrivate': 'Hide private',
  'toggle.hidePrivate.hint': 'Drop private, loopback and link-local addresses',
  'toggle.hideSpecial': 'Hide special-use',
  'toggle.hideSpecial.hint': 'Also drop documentation, reserved and multicast ranges',

  'seg.order': 'Order',
  'order.original': 'as written',
  'order.numeric': 'numeric',
  'order.reverse': 'reversed',
  'seg.cidr': 'CIDR',
  'cidr.strip': 'strip',
  'cidr.keep': 'keep',
  'cidr.drop': 'drop block',
  'seg.format': 'Format',
  'fmt.newline': 'lines',
  'fmt.comma': 'commas',
  'fmt.space': 'spaces',
  'fmt.json': 'json',
  'format.hint.newline': 'one per line',

  'controls.aria': 'Processing options',

  'foot.privacy': 'Runs entirely in your browser — no uploads, no tracking',
  'foot.version': 'v1.1',

  'toast.copied': 'Copied to clipboard',
  'toast.copyEmpty': 'Nothing to copy.',
  'toast.copyBlocked': 'The browser blocked the clipboard. Select the text and copy it manually.',
  'toast.copyFailed': 'Copy failed in this browser.',
  'toast.saved': 'Saved {name}',
  'toast.nothingToDownload': 'Nothing to download yet.',
  'toast.fileTooBig': 'File is {size} MB — the limit is 2 MB. Paste the list instead.',
  'toast.fileEmpty': 'That file is empty — nothing to extract.',
  'toast.fileUnreadable': 'Could not read that file. Try pasting the text instead.',
  'toast.fileLoaded': 'Loaded {name}',
  'toast.reset': 'Settings are back to their defaults',
};

export const dictionaries: Record<Lang, Record<TranslationKey, string>> = { fa, en };

/** DOM locale + writing direction for each UI language. */
export const locale: Record<Lang, { lang: string; dir: 'rtl' | 'ltr' }> = {
  fa: { lang: 'fa', dir: 'rtl' },
  en: { lang: 'en', dir: 'ltr' },
};

export function translate(lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string {
  const table = dictionaries[lang] ?? dictionaries.fa;
  const raw = table[key] ?? dictionaries.fa[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}