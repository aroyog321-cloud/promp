export const LEVEL_MAP: Record<string, string> = {
  LIGHT:            'LIGHT',
  MEDIUM:           'MEDIUM',
  AGGRESSIVE:       'AGGRESSIVE',
  EXPERT:           'EXPERT',
  BASIC:            'BASIC',
  PROFESSIONAL:     'PROFESSIONAL',
  'STAFF+':         'STAFF+',
  STAFF_PLUS:       'STAFF+',
  RESEARCH:         'RESEARCH',
  'PRODUCTION AUDIT':  'PRODUCTION AUDIT',
  PRODUCTION_AUDIT: 'PRODUCTION AUDIT',
};

export const MODE_MAP: Record<string, string> = {
  AUTO:             'GENERAL', // fallback for unresolved auto
  GENERAL:          'GENERAL',
  DEVELOPER:        'DEVELOPER',
  DESIGNER:         'DESIGNER',
  MARKETING:        'MARKETING',
  RESEARCH:         'RESEARCH',
  BUSINESS:         'BUSINESS',
  CONTENT_CREATOR:  'CONTENT_CREATOR',
  STARTUP_FOUNDER:  'STARTUP_FOUNDER',
};

export function normalizeLevel(raw: string | undefined): string {
  const key = (raw ?? '').toUpperCase().replace(/-/g, '_').replace(/ /g, '_');
  return LEVEL_MAP[raw?.toUpperCase() ?? ''] ?? LEVEL_MAP[key] ?? 'MEDIUM';
}

export function normalizeMode(raw: string | undefined): string {
  const key = (raw ?? '').toUpperCase().replace(/-/g, '_');
  return MODE_MAP[key] ?? 'GENERAL';
}
