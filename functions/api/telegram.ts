import { handleTelegramWebhook, type TelegramBotEnv } from '../../src/lib/telegram-bot';

export async function onRequestPost(context: {
  request: Request;
  env: TelegramBotEnv;
}): Promise<Response> {
  return handleTelegramWebhook(context.request, context.env);
}
