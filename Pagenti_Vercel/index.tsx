
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './I18nContext';
import { AresThemeProvider } from './contexts/AresThemeContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <I18nProvider>
        <AresThemeProvider>
          <App />
        </AresThemeProvider>
      </I18nProvider>
    </React.StrictMode>
  );
} catch (error) {
  console.error("Failed to render the application:", error);
}
