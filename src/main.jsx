import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './styles/global.css';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';

injectSpeedInsights();

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppErrorBoundary>
);
