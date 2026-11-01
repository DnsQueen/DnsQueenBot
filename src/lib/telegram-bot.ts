import { extractIps } from '../engine/ip-parser';

const MAX_INPUT_BYTES = 2 * 1024 * 1024;
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
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
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
  const body = (await response.json()) as { ok?: boolean; result?: T; description?: string };
  if (!response.ok || !body.ok || body.result === undefined) {
    throw new Error(body.description || `Telegram ${method} failed (${response.status})`);
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
  form.set('document', new Blob([output], { type: 'text/plain; charset=utf-8' }), 'dnsqueen-results.txt');
  const response = await fetcher(`${TELEGRAM_API}/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const body = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !body.ok) throw new Error(body.description || `Telegram sendDocument failed (${response.status})`);
}

async function readTelegramText(
  token: string,
  document: TelegramDocument,
  fetcher: TelegramFetch,
): Promise<string> {
  const name = document.file_name ?? '';
  if (!name.toLowerCase().endsWith('.txt')) throw new Error('فقط فایل‌های .txt پشتیبانی می‌شوند.');
  if (document.file_size !== undefined && document.file_size > MAX_INPUT_BYTES) {
    throw new Error('حجم فایل نباید بیشتر از ۲ مگابایت باشد.');
  }

  const file = await telegramCall<{ file_path?: string }>(token, 'getFile', {
    file_id: document.file_id,
  }, fetcher);
  if (!file.file_path) throw new Error('مسیر دریافت فایل از تلگرام برنگشت.');

  const response = await fetcher(`${TELEGRAM_API}/file/bot${token}/${file.file_path}`);
  if (!response.ok) throw new Error(`دریافت فایل از تلگرام ناموفق بود (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_INPUT_BYTES) throw new Error('حجم فایل نباید بیشتر از ۲ مگابایت باشد.');
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^\uFEFF/, '');
}

export async function processTelegramUpdate(
  update: TelegramUpdate,
  env: TelegramBotEnv,
  fetcher: TelegramFetch = fetch,
): Promise<void> {
  const message = update.message;
  if (!message?.chat?.id) return;

  try {
    let source: string;
    if (typeof message.text === 'string') {
      source = message.text;
      if (new TextEncoder().encode(source).byteLength > MAX_INPUT_BYTES) {
        throw new Error('متن ارسالی نباید بیشتر از ۲ مگابایت باشد.');
      }
    } else if (message.document) {
      source = await readTelegramText(env.BOT_TOKEN, message.document, fetcher);
    } else {
      await sendText(env.BOT_TOKEN, message.chat.id,
        'متن IPها را ارسال کن یا یک فایل .txt بفرست. حداکثر حجم ورودی ۲ مگابایت است.', fetcher);
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
    await sendResult(env.BOT_TOKEN, message.chat.id, result.formattedOutput, result.stats, fetcher);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'خطای ناشناخته در پردازش ورودی.';
    await sendText(env.BOT_TOKEN, message.chat.id, `خطا: ${messageText}`, fetcher);
  }
}

export async function handleTelegramWebhook(
  request: Request,
  env: TelegramBotEnv,
  fetcher: TelegramFetch = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
  if (!env.BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ ok: false, error: 'server_not_configured' }, 500);
  }

  const suppliedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
  if (!safeEqual(suppliedSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 1024 * 1024) return json({ ok: false, error: 'payload_too_large' }, 413);

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  try {
    await processTelegramUpdate(update, env, fetcher);
    return json({ ok: true });
  } catch {
    // Do not expose bot tokens, Telegram responses, or internal errors to webhook callers.
    return json({ ok: false, error: 'telegram_processing_failed' }, 502);
  }
}
