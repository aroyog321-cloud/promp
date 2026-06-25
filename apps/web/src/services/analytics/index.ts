export const sanitizeAnalytics = (properties: Record<string, any>) => {
  const sanitized = { ...properties };
  const sensitiveKeys = ['prompt', 'optimized', 'apikey', 'token', 'email'];
  
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  const safeProperties = properties ? sanitizeAnalytics(properties) : {};
  
  if (process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true') {
    // posthog.capture(eventName, safeProperties)
    console.log('[PostHog]', eventName, safeProperties);
  } else {
    // Local dev logging
    // console.log('[Analytics Stub]', eventName, safeProperties);
  }
};
