import * as Sentry from '@sentry/nextjs';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  route?: string;
  tier?: string;
  provider?: string;
  mode?: string;
  [key: string]: any;
}

export const captureError = (error: Error | unknown, context?: ErrorContext) => {
  const payload = {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context
  };

  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true') {
    Sentry.withScope((scope) => {
      if (context?.tier) scope.setTag("tier", context.tier);
      if (context?.provider) scope.setTag("provider", context.provider);
      if (context?.mode) scope.setTag("mode", context.mode);
      
      const extraContext = { ...context };
      delete extraContext.tier;
      delete extraContext.provider;
      delete extraContext.mode;
      
      scope.setExtras(extraContext);
      Sentry.captureException(error);
    });
  } else {
    console.error('[Local Error]', payload);
  }
};
