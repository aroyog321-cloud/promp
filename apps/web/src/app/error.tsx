'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import Link from 'next/link';
import { captureError } from '@/services/monitoring';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
    captureError(error, { context: 'Next.js App Boundary' });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
      <h2 className="text-2xl font-bold text-white mb-4">Something went wrong!</h2>
      <p className="text-zinc-400 mb-8 max-w-md">
        We've encountered an unexpected error. Our team has been notified.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-promptly-cyan text-black font-semibold rounded-xl hover:bg-promptly-cyan/90 transition-colors"
        >
          Try again
        </button>
        <Link 
          href="/"
          className="px-4 py-2 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
