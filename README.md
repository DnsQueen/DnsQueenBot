````markdown
# DNSQUEEN

A lightweight IP extraction tool for the web and Telegram.

DNSQUEEN extracts IPv4 and IPv6 addresses from text and `.txt` files, removes duplicates, and produces a clean list you can copy or save. It provides a browser-based interface and an optional Telegram bot.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
- [Set up the Telegram bot](#set-up-the-telegram-bot)
- [Connect the Telegram Mini App](#connect-the-telegram-mini-app)
- [Test the deployment](#test-the-deployment)
- [Configuration reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Development and contributions](#development-and-contributions)
- [Privacy and security](#privacy-and-security)
- [License](#license)

---

## Overview

DNSQUEEN has two entry points:

1. **Web application** — a browser-based interface for extracting and managing IP addresses.
2. **Telegram bot** — accepts text messages and `.txt` documents, extracts IP addresses, and returns the result.

The web application can be deployed and used independently. The Telegram bot is optional.

DNSQUEEN is not a DNS resolver, proxy, VPN, IP scanner, or connectivity tester. It extracts IP address strings from supplied content; it does not test whether an address is online or reachable.

## Features

### Web application

- Extract IPv4 and IPv6 addresses from pasted text.
- Import text files.
- Remove duplicate addresses.
- Preserve input order or sort the results.
- Copy individual addresses or the complete result.
- Export extracted addresses as TXT.
- Filter private and special-use addresses.
- Handle ports and CIDR notation according to the selected options.
- Persian and English interface.
- Right-to-left layout for Persian.
- Dark and light themes.
- Responsive layout for mobile and desktop.

### Telegram bot

- Accept IP-containing text messages.
- Accept `.txt` document uploads.
- Extract IPv4 and IPv6 addresses.
- Remove duplicates while preserving their original order.
- Return manageable results as a Telegram message.
- Send larger results as a TXT document.
- Provide `/start` and `/help` commands.

The bot uses the same extraction engine as the web application.

---

## How it works

```text
                         DNSQUEEN
                            |
              +-------------+-------------+
              |                           |
         Web application             Telegram bot
              |                           |
       Browser interface             Telegram user
              |                           |
       IP extraction engine          Telegram Bot API
              |                           |
       Result in browser             Cloudflare Pages
                                          |
                                    Pages Function
                                          |
                                    IP extraction
                                          |
                                  Telegram Bot API
                                          |
                                  Message or TXT file
````

### Web application

The web interface runs in the visitor's browser. Text entered into the web application is processed locally by the frontend. The web extraction workflow does not require a DNSQUEEN application server or database.

### Telegram bot

Telegram sends bot updates to a Cloudflare Pages Function at:

```text
https://YOUR-PROJECT.pages.dev/api/telegram
```

The Function validates the webhook secret, processes the incoming message, extracts addresses, and sends the result through the Telegram Bot API.

The Telegram integration requires a Cloudflare Pages deployment, two encrypted secrets, and a working Telegram bot.

### Requirements

### For local development

* Git

* Node.js

* npm

### For deployment

* GitHub account

* Cloudflare account

* A Cloudflare Pages project connected to this repository

### Additional requirements for the Telegram bot

* Telegram account

* Bot token created through [@BotFather](https://t.me/BotFather?utm_source=chatgpt.com)

* Cloudflare Pages Functions enabled through Git-based deployment

* Cloudflare Pages production secrets

You do not need to configure the Telegram integration if you only want to deploy the web application.

### Run locally

Clone the repository:

```bash
git clone https://github.com/DnsQueen/DnsQueenBot.git
cd DnsQueenBot
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite prints the local development address in the terminal. Open that address in your browser.

### Run checks

Run the test suite:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

The production frontend is generated in:

```text
dist/
```

The local Vite server is intended for frontend development. It does not automatically reproduce the deployed Cloudflare Pages webhook environment or provide production Telegram secrets.

### Deploy to Cloudflare Pages

The recommended deployment method is connecting the GitHub repository directly to Cloudflare Pages.

This deploys both the built frontend and the Pages Functions directory.

### 1\. Connect GitHub

* Sign in to the [Cloudflare Dashboard](https://dash.cloudflare.com/?utm_source=chatgpt.com).

* Open Workers & Pages.

* Select Create application.

* Choose Pages and connect to Git.

* Authorize access to GitHub if requested.

* Select the `DnsQueenBot` repository.

### 2\. Configure the build

Use the following settings:

| Setting                | Value         |
| ---------------------- | ------------- |
| Framework preset       | Vite          |
| Production branch      | main          |
| Root directory         | /             |
| Build command          | npm run build |
| Build output directory | dist          |

Make sure the production branch matches the branch you intend to deploy. In the original DNSQUEEN repository, the production branch is `main`.

Save the settings and start the first deployment.

### 3\. Check the deployment

After a successful deployment, Cloudflare assigns a Pages address similar to:

```text
https://YOUR-PROJECT.pages.dev
```

Open it in a browser and verify that the application loads.

If you are also deploying the Telegram bot, its endpoint should be:

```text
https://YOUR-PROJECT.pages.dev/api/telegram
```

Important: Do not deploy only the contents of `dist/` if you need the Telegram bot. The webhook implementation is in the repository's `functions/` directory and must be deployed as a Cloudflare Pages Function.

### Set up the Telegram bot

The Telegram bot is an optional part of DNSQUEEN.

### 1\. Create a bot with BotFather

* Open [@BotFather](https://t.me/BotFather?utm_source=chatgpt.com).

* Send:

```text
/newbot
```

* Follow the instructions.

* Choose a display name and a unique username.

* Save the bot token securely.

The token is a credential. Anyone who obtains it may be able to control your bot.

Never put the token in source code, commit it to GitHub, or expose it in frontend environment variables.

### 2\. Add the required Cloudflare secrets

Open your Pages project:

Cloudflare Dashboard → Workers & Pages → your project → Settings → Variables and Secrets

In the Production environment, add the following values as encrypted secrets:

| Variable                | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| BOT_TOKEN               | Token issued by BotFather                             |
| TELEGRAM_WEBHOOK_SECRET | Secret used to authenticate Telegram webhook requests |

Generate a strong webhook secret on your own machine:

```bash
openssl rand -hex 32
```

Use the generated value for `TELEGRAM_WEBHOOK_SECRET`.

Do not use a `VITE_` prefix for these values. They must remain server-side secrets and must not be included in the browser bundle.

Save the settings.

If you add or change secrets after deployment, trigger a new deployment so the Function uses the updated configuration.

### 3\. Register the webhook

The webhook connects Telegram to your deployed Pages Function.

Use the actual Pages domain assigned to your project. Do not leave `YOUR-PROJECT` in the command.

For example:

```text
https://dnsqueenbot.pages.dev/api/telegram
```

To avoid putting credentials directly into the command, enter them through hidden shell prompts:

```bash
read -rsp "Telegram Bot Token: " BOT_TOKEN
echo
```

```bash
read -rsp "Webhook Secret: " WEBHOOK_SECRET
echo
```

Register the webhook:

```bash
curl -fsS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://YOUR-PROJECT.pages.dev/api/telegram\",\"secret_token\":\"${WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\"]}"
```

Replace the example domain with your actual Pages domain.

After Telegram confirms that the webhook was registered, clear the temporary shell variables:

```bash
unset BOT_TOKEN WEBHOOK_SECRET
```

A successful response looks like this:

```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

The `allowed_updates` setting above enables incoming messages, which are the updates used by the current bot workflow.

### 4\. Verify the webhook endpoint

Opening the endpoint in a browser sends a GET request. The webhook is designed for POST requests from Telegram.

A POST request without the correct Telegram secret header should return:

```json
{
  "ok": false,
  "error": "unauthorized"
}
```

An HTTP `401` response without the secret header is expected. It indicates that the endpoint is enforcing its authentication check; it is not, by itself, proof that the complete bot workflow is working.

### Connect the Telegram Mini App

The Mini App is configured separately from the bot webhook.

If you want users to open the DNSQUEEN web application from Telegram:

* Open [@BotFather](https://t.me/BotFather?utm_source=chatgpt.com).

* Select your bot.

* Open its Mini App configuration.

* Configure the Main Mini App or Menu Button, depending on the entry point you want to provide.

* Set the application URL to your deployed HTTPS Pages address.

For example:

```text
https://dnsqueenbot.pages.dev
```

Save the configuration and open the bot in Telegram to test it.

The Mini App loads the web application. Its frontend extraction features do not depend on the Telegram webhook.

### Test the deployment

### Test the web application

* Open the deployed Pages address.

* Paste a text containing IPv4 and IPv6 addresses.

* Check that valid addresses are extracted.

* Check duplicate removal.

* Try sorting and the available filters.

* Test copying and TXT export.

* Switch between Persian and English.

* Switch between dark and light themes.

* Test the interface on a mobile screen.

### Test the Telegram bot

Open a private chat with your bot and send:

```text
/start
```

Then:

```text
/help
```

Send this sample input:

```text
Google: 8.8.8.8
Cloudflare: 1.1.1.1
Google IPv6: 2001:4860:4860::8888
Duplicate: 8.8.8.8
Invalid: 999.999.999.999
```

The expected extracted addresses are:

```text
8.8.8.8
1.1.1.1
2001:4860:4860::8888
```

The invalid address should not appear, and the duplicate should appear only once.

Also test by uploading a `.txt` file containing several addresses.

Depending on the result size, the bot returns the extracted list as a message or sends it as a TXT document.

### Configuration reference

| Name                    | Required for | Purpose                                        |
| ----------------------- | ------------ | ---------------------------------------------- |
| BOT_TOKEN               | Telegram bot | Authenticates requests to the Telegram Bot API |
| TELEGRAM_WEBHOOK_SECRET | Telegram bot | Validates incoming webhook requests            |

Both values belong in Cloudflare Pages server-side secrets.

They are not required to run the browser application locally or deploy the web application without the Telegram bot.

### Input limits

The Telegram bot currently enforces these limits:

| Item                        | Limit |
| --------------------------- | ----- |
| Text input                  | 2 MiB |
| Uploaded TXT file           | 2 MiB |
| Webhook request body        | 1 MiB |
| Supported uploaded document | .txt  |

The web application's frontend limits and behavior should be checked in the application source rather than assumed to match the Telegram bot's limits.

### Troubleshooting

### The website works, but the Telegram bot does not respond

Check the following:

* The Pages deployment completed successfully.

* The webhook URL points to the correct project.

* `BOT_TOKEN` is configured as a Production secret.

* `TELEGRAM_WEBHOOK_SECRET` matches the value used when registering the webhook.

* The webhook is registered with Telegram.

You can inspect the webhook status using Telegram's `getWebhookInfo` method.

### Telegram reports a webhook error

Check the Pages Function logs in Cloudflare.

Verify that the URL is correct and that the Function is deployed at:

```text
/api/telegram
```

Also verify that the secret configured in Cloudflare is identical to the webhook secret registered with Telegram.

### The endpoint returns HTTP 401

This is expected when a request does not contain the correct Telegram webhook secret header.

Check that the secret in Cloudflare and the `secret_token` used in `setWebhook` match exactly.

### The website returns 404 for the bot endpoint

Check that:

* The repository is deployed through Cloudflare Pages Git integration.

* The `functions/` directory is present in the deployed branch.

* The deployment completed after the Function was added.

A static-only upload of the `dist/` directory does not include the repository's Pages Function source.

### The Mini App does not open

Check the URL configured in BotFather.

It must be the deployed HTTPS application address, not a local development address.

### The bot does not accept a document

The current bot workflow accepts `.txt` documents and enforces a 2 MiB input limit.

Check the file extension and size before testing again.

### Project structure

The repository is organized around the browser application, the shared extraction engine, and the Cloudflare webhook.

```text
DnsQueenBot/
├── functions/
│   └── api/
│       └── telegram.ts
├── public/
├── src/
│   ├── components/
│   ├── engine/
│   ├── lib/
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Key areas:

| Path                      | Responsibility                          |
| ------------------------- | --------------------------------------- |
| src/engine/               | IP parsing and extraction logic         |
| src/components/           | Web interface components                |
| src/lib/                  | Shared utilities and Telegram bot logic |
| functions/api/telegram.ts | Cloudflare Pages webhook endpoint       |
| src/App.tsx               | Main application interface              |

For exact implementation details, use the source files in the repository as the reference.

### Development and contributions

Contributions are welcome. Keep changes focused and verify them before opening a pull request.

### Suggested workflow

Fork the repository, clone your fork, and create a dedicated branch:

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/DnsQueenBot.git
cd DnsQueenBot

npm install

git switch -c feature/your-change
```

Before committing, run:

```bash
npm test
npm run lint
npm run build
```

Commit and push your branch:

```bash
git add .
git commit -m "Describe the change"
git push -u origin feature/your-change
```

Then open a Pull Request against the original repository's `main` branch.

### Pull request guidelines

A useful pull request should include:

* A clear description of the problem being addressed.

* A concise explanation of the implementation.

* Tests for changed behavior where applicable.

* Screenshots for visible interface changes.

* Any deployment or configuration changes that maintainers need to know about.

Do not include API tokens, webhook secrets, private configuration files, or user data in commits or pull requests.

### Privacy and security

* The web application's extraction workflow runs in the browser.

* The Telegram bot processes messages and documents sent to the bot through Telegram.

* Telegram bot credentials must remain server-side.

* The webhook checks Telegram's configured secret token.

* Do not commit `.env` files or credentials.

* Do not publish bot tokens or webhook secrets in issues, screenshots, logs, or support messages.

* Anyone deploying their own copy is responsible for their Cloudflare account, Telegram bot, secrets, and deployment configuration.

DNSQUEEN does not claim that an extracted IP address is reachable, safe, active, or associated with a particular service. Extraction is a text-processing operation.

### License

DNSQUEEN is distributed under the MIT License. See LICENSE for the full license text.
