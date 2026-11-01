import { extractIps } from '../engine/ip-parser';

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_WEBHOOK_BYTES = 1024 * 1024;
const MESSAGE_LIMIT = 3500;
const TELEGRAM_API = 'https://api.telegram.org';

type TelegramUser = { id: number; first_name?: string };
type TelegramDocument = {
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  file_id: string;
};
type TelegramMessage = {
  message_id: number;
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
  document?: TelegramDocument;
};
type TelegramUpdate = { update_id: number; message?: TelegramMessage };

export interface TelegramBotEnv {
  BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
}

export type TelegramFetch = typeof fetch;

class UserInputError extends Error {}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }

  return diff === 0;
}

/**
 * Reads a response/request stream without allowing it to exceed maxBytes.
 * The stream is cancelled immediately when the limit is crossed.
 */
async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array();

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;

      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new UserInputError('حجم ورودی از حد مجاز بیشتر است.');
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

async function telegramCall<T>(
  token: string,
  method: string,
  payload: unknown,
  fetcher: TelegramFetch,
): Promise<T> {
  const response = await fetcher(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let body: { ok?: boolean; result?: T };

  try {
    body = await response.json() as { ok?: boolean; result?: T };
  } catch {
    throw new Error('Invalid Telegram API response.');
  }

  if (!response.ok || !body.ok || body.result === undefined) {
    throw new Error(`Telegram ${method} request failed.`);
  }

  return body.result;
}

async function sendText(
  token: string,
  chatId: number,
  text: string,
  fetcher: TelegramFetch,
): Promise<void> {
  await telegramCall(token, 'sendMessage', {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }, fetcher);
}

async function sendResult(
  token: string,
  chatId: number,
  output: string,
  stats: ReturnType<typeof extractIps>['stats'],
  fetcher: TelegramFetch,
): Promise<void> {
  if (!output) {
    await sendText(token, chatId, 'هیچ IP معتبری در ورودی پیدا نشد.', fetcher);
    return;
  }

  if (output.length <= MESSAGE_LIMIT) {
    await sendText(token, chatId, output, fetcher);
    return;
  }

  const summary = [
    'DNSQUEEN — نتیجهٔ استخراج',
    `تعداد معتبر: ${stats.validUnique}`,
    `IPv4: ${stats.ipv4Count} | IPv6: ${stats.ipv6Count}`,
    `تکراری حذف‌شده: ${stats.duplicatesRemoved}`,
    '',
    'فهرست کامل در فایل TXT پیوست شده است.',
  ].join('\n');

  const form = new FormData();
  form.set('chat_id', String(chatId));
  form.set('caption', summary);
  form.set(
    'document',
    new Blob([output], { type: 'text/plain; charset=utf-8' }),
    'dnsqueen-results.txt',
  );

  const response = await fetcher(`${TELEGRAM_API}/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  });

  let body: { ok?: boolean };

  try {
    body = await response.json() as { ok?: boolean };
  } catch {
    throw new Error('Invalid Telegram document response.');
  }

  if (!response.ok || !body.ok) {
    throw new Error('Telegram document delivery failed.');
  }
}

function validateTelegramFilePath(path: string): void {
  if (
    path.length === 0 ||
    path.length > 512 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    !/^[A-Za-z0-9._/-]+$/.test(path) ||
    path.split('/').some(segment => segment === '.' || segment === '..')
  ) {
    throw new Error('Invalid Telegram file path.');
  }
}

async function readTelegramText(
  token: string,
  document: TelegramDocument,
  fetcher: TelegramFetch,
): Promise<string> {
  const name = document.file_name ?? '';

  if (!name.toLowerCase().endsWith('.txt')) {
    throw new UserInputError('فقط فایل‌های .txt پشتیبانی می‌شوند.');
  }

  if (
    document.file_size !== undefined &&
    document.file_size > MAX_INPUT_BYTES
  ) {
    throw new UserInputError('حجم فایل نباید بیشتر از ۲ مگابایت باشد.');
  }

  const file = await telegramCall<{ file_path?: string }>(
    token,
    'getFile',
    { file_id: document.file_id },
    fetcher,
  );

  if (!file.file_path) {
    throw new Error('Telegram did not return a file path.');
  }

  validateTelegramFilePath(file.file_path);

  const response = await fetcher(
    `${TELEGRAM_API}/file/bot${token}/${file.file_path}`,
  );

  if (!response.ok) {
    throw new Error('Telegram file download failed.');
  }

  let bytes: Uint8Array;

  try {
    bytes = await readBoundedBody(response.body, MAX_INPUT_BYTES);
  } catch (error) {
    if (error instanceof UserInputError) {
      throw new UserInputError('حجم فایل نباید بیشتر از ۲ مگابایت باشد.');
    }
    throw error;
  }

  return new TextDecoder('utf-8', { fatal: false })
    .decode(bytes)
    .replace(/^\uFEFF/, '');
}

async function handleCommand(
  text: string,
  chatId: number,
  token: string,
  fetcher: TelegramFetch,
): Promise<boolean> {
  const command = text.trim().split(/\s+/, 1)[0].toLowerCase();
  const normalized = command.replace(/@[\w]+$/, '');

  if (normalized === '/start') {
    await sendText(
      token,
      chatId,
      [
        'سلام! به DNSQUEEN خوش آمدی.',
        '',
        'متن شامل IP را بفرست یا یک فایل TXT ارسال کن تا آدرس‌های معتبر استخراج شوند.',
        '',
        'حداکثر حجم ورودی: ۲ مگابایت',
        'پشتیبانی از IPv4 و IPv6',
        'حذف موارد تکراری و حفظ ترتیب ورودی',
        '',
        'برای راهنما دستور /help را بفرست.',
      ].join('\n'),
      fetcher,
    );
    return true;
  }

  if (normalized === '/help') {
    await sendText(
      token,
      chatId,
      [
        'راهنمای DNSQUEEN',
        '',
        '۱. متن یا فهرست IPها را مستقیماً ارسال کن.',
        '۲. می‌توانی فایل متنی با پسوند .txt بفرستی.',
        '۳. آدرس‌های IPv4 و IPv6 شناسایی می‌شوند.',
        '۴. موارد تکراری حذف می‌شوند.',
        '۵. ترتیب اصلی ورودی حفظ می‌شود.',
        '',
        'حداکثر حجم ورودی: ۲ مگابایت',
        'فایل‌های غیر TXT پشتیبانی نمی‌شوند.',
        '',
        'دستورها:',
        '/start — شروع کار',
        '/help — نمایش راهنما',
      ].join('\n'),
      fetcher,
    );
    return true;
  }

  return false;
}

export async function processTelegramUpdate(
  update: TelegramUpdate,
  env: TelegramBotEnv,
  fetcher: TelegramFetch = fetch,
): Promise<void> {
  const message = update.message;

  if (!message?.chat?.id) return;

  try {
    if (
      typeof message.text === 'string' &&
      await handleCommand(message.text, message.chat.id, env.BOT_TOKEN, fetcher)
    ) {
      return;
    }

    let source: string;

    if (typeof message.text === 'string') {
      source = message.text;

      if (new TextEncoder().encode(source).byteLength > MAX_INPUT_BYTES) {
        throw new UserInputError('متن ارسالی نباید بیشتر از ۲ مگابایت باشد.');
      }
    } else if (message.document) {
      source = await readTelegramText(
        env.BOT_TOKEN,
        message.document,
        fetcher,
      );
    } else {
      await sendText(
        env.BOT_TOKEN,
        message.chat.id,
        'متن IPها را ارسال کن یا یک فایل .txt بفرست. حداکثر حجم ورودی ۲ مگابایت است.',
        fetcher,
      );
      return;
    }

    const result = extractIps(source, {
      includeIpv4: true,
      includeIpv6: true,
      removeDuplicates: true,
      excludePrivate: false,
      excludeSpecial: false,
      keepPort: false,
      sortMode: 'original',
      cidrMode: 'strip-mask',
      outputFormat: 'newline',
    });

    await sendResult(
      env.BOT_TOKEN,
      message.chat.id,
      result.formattedOutput,
      result.stats,
      fetcher,
    );
  } catch (error) {
    const userMessage = error instanceof UserInputError
      ? error.message
      : 'پردازش پیام با خطا مواجه شد. لطفاً دوباره تلاش کن.';

    await sendText(
      env.BOT_TOKEN,
      message.chat.id,
      `خطا: ${userMessage}`,
      fetcher,
    );
  }
}

export async function handleTelegramWebhook(
  request: Request,
  env: TelegramBotEnv,
  fetcher: TelegramFetch = fetch,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  if (!env.BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ ok: false, error: 'server_not_configured' }, 500);
  }

  const suppliedSecret =
    request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';

  if (!safeEqual(suppliedSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const contentLengthHeader = request.headers.get('content-length');

  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);

    if (
      !Number.isFinite(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_WEBHOOK_BYTES
    ) {
      return json({ ok: false, error: 'payload_too_large' }, 413);
    }
  }

  let update: TelegramUpdate;

  try {
    const bytes = await readBoundedBody(
      request.body,
      MAX_WEBHOOK_BYTES,
    );

    update = JSON.parse(
      new TextDecoder().decode(bytes),
    ) as TelegramUpdate;

    if (
      !update ||
      typeof update !== 'object' ||
      !Number.isInteger(update.update_id)
    ) {
      return json({ ok: false, error: 'invalid_update' }, 400);
    }
  } catch (error) {
    if (error instanceof UserInputError) {
      return json({ ok: false, error: 'payload_too_large' }, 413);
    }

    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  try {
    await processTelegramUpdate(update, env, fetcher);
    return json({ ok: true });
  } catch {
    return json(
      { ok: false, error: 'telegram_processing_failed' },
      502,
    );
  }
}
