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

describe('Telegram bot commands and input limits', () => {
  it('handles /start and /help without running IP extraction', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(telegramOk({ message_id: 1 })));

    await processTelegramUpdate({
      update_id: 10,
      message: { message_id: 10, chat: { id: 42 }, text: '/start' },
    }, env, fetcher as unknown as typeof fetch);

    await processTelegramUpdate({
      update_id: 11,
      message: { message_id: 11, chat: { id: 42 }, text: '/help' },
    }, env, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(2);

    const first = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    const second = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));

    expect(first.text).toContain('DNSQUEEN');
    expect(second.text).toContain('/start');
  });

  it('rejects an oversized webhook body even without Content-Length', async () => {
    const secret = env.TELEGRAM_WEBHOOK_SECRET;
    const oversized = new TextEncoder().encode(
      `{"update_id":1,"padding":"${'x'.repeat(1024 * 1024)}"}`
    );

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversized);
        controller.close();
      },
    });

    const request = new Request('https://example.test/api/telegram', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': secret,
      },
      body: stream,
      duplex: 'half',
    } as RequestInit);

    const response = await handleTelegramWebhook(request, env);

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      ok: false,
      error: 'payload_too_large',
    });
  });

  it('rejects a file that exceeds 2 MB while downloading', async () => {
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1);

    const downloadResponse = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(oversized);
          controller.close();
        },
      }),
    );

    const fetcher = vi.fn()
      .mockResolvedValueOnce(telegramOk({ file_path: 'documents/test.txt' }))
      .mockResolvedValueOnce(downloadResponse)
      .mockResolvedValueOnce(telegramOk({ message_id: 1 }));

    await processTelegramUpdate({
      update_id: 12,
      message: {
        message_id: 12,
        chat: { id: 42 },
        document: {
          file_id: 'file-id',
          file_name: 'test.txt',
          file_size: 100,
        },
      },
    }, env, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(3);

    const [, init] = fetcher.mock.calls[2] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.text).toContain('۲ مگابایت');
  });

  it('does not expose internal errors to Telegram users', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('SECRET_INTERNAL_ERROR'))
      .mockResolvedValueOnce(telegramOk({ message_id: 1 }));

    await processTelegramUpdate({
      update_id: 13,
      message: {
        message_id: 13,
        chat: { id: 42 },
        text: '8.8.8.8',
      },
    }, env, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(2);

    const [, init] = fetcher.mock.calls[1] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.text).toContain('دوباره تلاش کن');
    expect(payload.text).not.toContain('SECRET_INTERNAL_ERROR');
  });
});

describe('Unknown Telegram commands', () => {
  it('shows help guidance instead of treating unknown commands as IP input', async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(telegramOk({ message_id: 1 }))
    );

    await processTelegramUpdate({
      update_id: 14,
      message: {
        message_id: 14,
        chat: { id: 42 },
        text: '/unknown',
      },
    }, env, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(1);

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(payload.text).toContain('/help');
  });
});
