DNSQUEEN 👑

A Privacy-Focused IP Extraction & Management Tool with an Optional Telegram Bot.

DNSQUEEN is a lightweight IP extraction and management application designed to work as a standalone web app and an optional Telegram Bot.

It supports IPv4, IPv6, text processing, duplicate removal, sorting, TXT file processing, and Telegram integration — all deployable on your own Cloudflare account.

✨ Features

Web Application

- Extract IPv4 and IPv6 addresses from text.
- Process and extract IP addresses from TXT files.
- Remove duplicate IP addresses.
- Sort extracted addresses.
- Copy individual IP addresses or all results.
- Export results as TXT.
- Support for IPv4 and IPv6.
- Private and special-use IP filtering options.
- Port handling options.
- CIDR mask handling.
- Persian and English interface.
- Persian RTL layout.
- Dark and light themes.
- Responsive design for desktop and mobile.
- Runs independently without requiring a backend.

Telegram Bot

DNSQUEEN also includes an optional Telegram Bot powered by Cloudflare Pages Functions.

The bot can:

- Extract IPv4 and IPv6 addresses from messages.
- Process uploaded ".txt" files.
- Remove duplicate IP addresses.
- Return extracted IP addresses in a Telegram message.
- Handle "/start" and "/help" commands.
- Provide helpful responses for unknown commands.

The Telegram Bot is optional. You can use the web application without configuring or deploying a bot.

🏗️ Architecture

DNSQUEEN consists of two independent parts:

1. Frontend — Web Application

- React
- TypeScript
- Vite
- Client-side IP extraction and processing
- No central backend or database required

2. Optional Telegram Bot

- Cloudflare Pages Functions
- Telegram Bot API
- Webhook-based updates
- Cloudflare encrypted environment secrets

The frontend and Telegram Bot are deployed together on Cloudflare Pages, but they operate independently.

Each user can deploy their own instance using their own Cloudflare account and their own Telegram Bot token.

No shared bot token, central server, or central database is required.

🚀 Deployment

Requirements

- A GitHub account
- A Cloudflare account
- A Telegram account (only if you want to enable the Telegram Bot)
- A Telegram Bot token from BotFather (only for bot deployment)

1. Fork the Repository

Fork this repository to your own GitHub account:

https://github.com/DnsQueen/DnsQueenBot

You can also clone it locally:

git clone https://github.com/DnsQueen/DnsQueenBot.git
cd DnsQueenBot
npm install

2. Deploy to Cloudflare Pages

The recommended deployment method is Cloudflare Pages with Git integration.

1. Open the Cloudflare Dashboard.
2. Go to Workers & Pages.
3. Select Create application.
4. Choose Pages.
5. Connect your GitHub account.
6. Select your forked DNSQUEEN repository.
7. Select the branch you want to deploy.

For the original development branch, use:

"feature/telegram-bot"

Configure the build settings:

Setting| Value
Framework preset| Vite
Production branch| "feature/telegram-bot"
Root directory| "/"
Build command| "npm run build"
Build output directory| "dist"

Save and deploy.

Cloudflare Pages will build the frontend and deploy the Pages Functions from the repository's "functions/" directory.

Important: Do not use a simple static ZIP upload or drag-and-drop deployment if you want the Telegram Bot to work. Static-only uploads may deploy the frontend without compiling and deploying the "functions/" directory.

The Git integration method is recommended because it handles both the frontend and Pages Functions.

3. Optional: Deploy with Wrangler

You can also build and deploy the project using Wrangler.

Install dependencies and build:

npm install
npm run build

Deploy using:

npx wrangler pages deploy dist

Make sure the "functions/" directory is present at the project root alongside "dist/" when deploying. Verify that your Wrangler version and deployment configuration support Pages Functions before relying on this method.

🤖 Telegram Bot Setup

The Telegram Bot is optional.

You can skip this entire section if you only want to use the web application.

1. Create a Telegram Bot

1. Open Telegram.
2. Search for "@BotFather" (https://t.me/BotFather).
3. Send "/newbot".
4. Follow the instructions.
5. Copy the bot token.

Never publish your bot token or commit it to GitHub.

2. Configure Cloudflare Secrets

Open your Cloudflare Dashboard:

Workers & Pages → Your DNSQUEEN Project → Settings → Variables and Secrets

Add the following encrypted secrets:

Variable| Description
"BOT_TOKEN"| Your Telegram Bot API token
"TELEGRAM_WEBHOOK_SECRET"| A private secret used to authenticate webhook requests

Both values must be configured as encrypted secrets, not exposed as frontend variables.

Generate a strong webhook secret using:

openssl rand -hex 32

Copy the generated value and save it as "TELEGRAM_WEBHOOK_SECRET".

Save your Telegram Bot token as "BOT_TOKEN".

After adding or changing secrets, redeploy the project if required by Cloudflare Pages.

3. Register the Telegram Webhook

Your webhook endpoint is:

https://YOUR-DOMAIN.pages.dev/api/telegram

Replace "YOUR-DOMAIN.pages.dev" with your actual Cloudflare Pages domain.

Register the webhook using the following command:

read -rsp "Telegram Bot Token: " BOT_TOKEN
echo
read -rsp "Webhook Secret: " WEBHOOK_SECRET
echo

curl -fsS -X POST \
  "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://YOUR-DOMAIN.pages.dev/api/telegram\",\"secret_token\":\"${WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\"]}"

unset BOT_TOKEN WEBHOOK_SECRET

Replace the webhook URL with your actual domain before running the command.

The token and webhook secret are entered without being displayed in the terminal.

A successful Telegram response should contain:

{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}

4. Test Your Bot

Open your bot in Telegram and test:

- "/start"
- "/help"
- "/unknown"
- Send a text message containing IPv4 and IPv6 addresses.
- Upload a ".txt" file containing IP addresses.

The bot should process the input and return the extracted IP addresses.

📱 Telegram Mini App (Optional)

The web application can also be connected to your Telegram Bot as a Mini App.

This is optional and separate from the bot's message-processing functionality.

To configure it:

1. Open "@BotFather" (https://t.me/BotFather).
2. Select your bot.
3. Open the Mini Apps configuration options.
4. Set your deployed Cloudflare Pages URL as the Mini App URL.
5. Save the configuration.

Your web application can then be opened inside Telegram.

The Mini App does not require the Telegram Bot webhook to perform its client-side IP extraction functionality.

🔐 Security & Privacy

DNSQUEEN is designed to avoid unnecessary data collection.

- IP extraction in the web application is performed locally in the browser.
- No central database is required.
- Each deployment uses its own Cloudflare account.
- Each bot deployment uses its own Telegram Bot token.
- Bot tokens must remain in Cloudflare encrypted secrets.
- Webhook requests are authenticated using "TELEGRAM_WEBHOOK_SECRET".
- Webhook request bodies are limited to 1 MB.
- Uploaded TXT files are limited to 2 MB.
- Only ".txt" files are accepted by the bot.
- Telegram API errors are not returned directly to users.
- File paths are validated before processing.

Important: When using the Telegram Bot, messages and files are processed through Telegram and your own Cloudflare deployment. Do not send sensitive information that you do not want processed by those services.

🛠️ Local Development

Clone the repository:

git clone https://github.com/DnsQueen/DnsQueenBot.git
cd DnsQueenBot

Install dependencies:

npm install

Start the development server:

npm run dev

Run tests:

npm test

Run the production build:

npm run build

The Telegram Bot requires Cloudflare Pages Functions and configured environment secrets. The ordinary Vite development server alone does not provide the complete production webhook environment.

📁 Project Structure

DnsQueenBot/
├── functions/
│   └── api/
│       └── telegram.ts
├── src/
│   ├── components/
│   ├── lib/
│   │   └── telegram-bot.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts

📋 Limits

Feature| Limit
Telegram webhook request body| 1 MB
Telegram TXT file input| 2 MB
Accepted Telegram file type| ".txt"

These limits apply to the Telegram Bot processing functionality.

📄 License

This project is licensed under the MIT License.

You are free to use, modify, distribute, and deploy your own instance under the terms of the license.

---

DNSQUEEN 👑

Your IPs. Your tools. Your infrastructure.
