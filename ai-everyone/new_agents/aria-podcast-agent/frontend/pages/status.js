import { useEffect, useState } from 'react';
import { getHealth } from '../services/api';

export default function StatusPage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setError('Backend not reachable'));
  }, []);

  return (
    <div style={{
      background: '#0a0a0f', color: '#e2e2f0', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', padding: '2rem'
    }}>
      <div style={{ maxWidth: 500, width: '100%' }}>
        <h1 style={{ color: '#7c3aed', marginBottom: '1.5rem' }}>🎙️ ARIA — System Status</h1>
        {error && <p style={{ color: '#ef4444' }}>❌ {error}</p>}
        {health && (
          <pre style={{
            background: '#111118', border: '1px solid #252535',
            borderRadius: 8, padding: '1rem', fontSize: 13,
            overflow: 'auto'
          }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
        {!health && !error && <p style={{ color: '#6b6b8a' }}>Checking…</p>}
        <a href="/" style={{ color: '#7c3aed', marginTop: '1rem', display: 'inline-block' }}>
          ← Back to ARIA
        </a>
      </div>
    </div>
  );
}
