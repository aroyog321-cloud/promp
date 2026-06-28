'use client';

import { useEffect } from 'react';
import { captureError } from '@/services/monitoring';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
    captureError(error, { context: 'Next.js Global Boundary' });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground flex items-center justify-center min-h-screen font-sans">
        <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Critical Error</h2>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            A critical error occurred while rendering this page. Our team has been notified and is looking into it.
          </p>
          <button
            onClick={() => reset()}
            className="w-full px-4 py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
          >
            Attempt Recovery
          </button>
        </div>
      </body>
    </html>
  );
}
