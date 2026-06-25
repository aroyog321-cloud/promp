import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProd = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
  tracesSampleRate: isProd ? 0.1 : 1.0,
  profilesSampleRate: isProd ? 0.1 : 1.0,
  debug: false,
  
  ignoreErrors: [
    "401",
    "403",
    "429",
    "Unauthorized",
    "Too Many Requests"
  ],

  beforeSend(event) {
    if (event.request?.data) {
      const data = event.request.data;
      if (typeof data === 'object') {
        if ('prompt' in data) delete data.prompt;
        if ('apikey' in data) delete data.apikey;
        if ('email' in data) delete data.email;
        if ('text' in data) delete data.text; // Just in case, as 'text' is our prompt field
      }
    }
    
    // Scrub URL params for PII
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/apikey=[^&]*/gi, 'apikey=***');
      event.request.url = event.request.url.replace(/email=[^&]*/gi, 'email=***');
    }

    return event;
  },
});
