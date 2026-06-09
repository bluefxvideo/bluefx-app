'use client';

/**
 * Root error boundary — catches render errors that would otherwise blank the
 * entire app with no message. Must render its own <html>/<body> per Next.js.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#a1a1aa', maxWidth: 420, margin: 0 }}>
            An unexpected error occurred. Your work is saved where possible — try again, and if it keeps happening contact support.
          </p>
          {error?.digest && <p style={{ color: '#52525b', fontSize: 12, margin: 0 }}>Error code: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
