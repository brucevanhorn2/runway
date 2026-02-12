import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Suppress ResizeObserver errors (benign browser warning, not a real error)
const resizeObserverError = window.console.error;
window.console.error = (...args) => {
  if (args[0]?.includes?.('ResizeObserver')) {
    return;
  }
  resizeObserverError(...args);
};
window.addEventListener('error', (e) => {
  if (e.message?.includes('ResizeObserver')) {
    e.stopImmediatePropagation();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
