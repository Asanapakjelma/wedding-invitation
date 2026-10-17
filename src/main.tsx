import './index.css'; // <-- PASTIKAN BARIS INI ADA DI PALING ATAS FILE main.tsx
import faviconLogo from './assets/Logo Fidsa Tunas Invitation_Light.png';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/png';
favicon.href = `${faviconLogo}?v=brand-light`;
document.head.appendChild(favicon);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
