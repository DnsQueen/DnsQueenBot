import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initTelegram } from './lib/telegram';

// Boots the Mini App (ready + expand + chrome) before the first paint.
// A no-op in a normal browser tab, so nothing here depends on Telegram.
initTelegram();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
