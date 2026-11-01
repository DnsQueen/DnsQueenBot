import { describe, expect, it, vi } from 'vitest';
import { handleTelegramWebhook, processTelegramUpdate, type TelegramBotEnv } from './telegram-bot';

const env: TelegramBotEnv = {
  BOT_TOKEN: 'test-token',
  TELEGRAM_WEBHOOK_SECRET: 'test-secret',
};

function telegramOk(result: unknown = true): Response {
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Telegram webhook security', () => {
  it('rejects requests with a missing or incorrect webhook secret', async () => {
    const request = new Request('https://example.test/api/telegram', { method: 'POST', body: '{}' });
    const response = await handleTelegramWebhook(request, env, vi.fn() as unknown as typeof fetch);
    expect(response.status).toBe(401);
  });

  it('rejects non-POST requests', async () => {
    const request = new Request('https://example.test/api/telegram');
    const response = await handleTelegramWebhook(request, env);
    expect(response.status).toBe(405);
  });

  it('rejects malformed JSON', async () => {
    const request = new Request('https://example.test/api/telegram', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': env.TELEGRAM_WEBHOOK_SECRET },
      body: '{',
    });
    const response = await handleTelegramWebhook(request, env);
    expect(response.status).toBe(400);
  });
});

describe('Telegram update processing', () => {
  it('reuses the DNSQUEEN engine and sends short output as a message', async () => {
    const fetcher = vi.fn().mockResolvedValue(telegramOk({ message_id: 1 }));
    await processTelegramUpdate({
      update_id: 1,
      message: { message_id: 1, chat: { id: 42 }, text: '8.8.8.8\n1.1.1.1' },
    }, env, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body)) as { text: string };
    expect(payload.text).toBe('8.8.8.8\n1.1.1.1');
    expect(fetcher.mock.calls[0]?.[0]).toContain('/sendMessage');
  });

  it('rejects non-TXT documents with a user-facing message', async () => {
    const fetcher = vi.fn().mockResolvedValue(telegramOk({ message_id: 1 }));
    await processTelegramUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        chat: { id: 42 },
        document: { file_id: 'file-id', file_name: 'input.csv', file_size: 10 },
      },
    }, env, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).text).toContain('.txt');
  });

  it('rejects documents larger than 2 MB before downloading', async () => {
    const fetcher = vi.fn().mockResolvedValue(telegramOk({ message_id: 1 }));
    await processTelegramUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        chat: { id: 42 },
        document: { file_id: 'file-id', file_name: 'large.txt', file_size: 2 * 1024 * 1024 + 1 },
      },
    }, env, fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).text).toContain('۲ مگابایت');
  });
});
