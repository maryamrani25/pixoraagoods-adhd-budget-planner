import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './lib/store';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ maxWidth: 520, margin: '15vh auto', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <h1 style={{ fontFamily: 'Lora, Georgia, serif', fontSize: 28 }}>Something went wrong</h1>
        <p>Your data is still saved on this device. Reloading the page usually fixes this.</p>
        <button onClick={() => location.reload()} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 14, background: '#30213F', color: '#fff', border: 0 }}>Reload</button>
        <pre style={{ marginTop: 24, fontSize: 12, whiteSpace: 'pre-wrap', color: '#827B88' }}>{String(this.state.error.message)}</pre>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
