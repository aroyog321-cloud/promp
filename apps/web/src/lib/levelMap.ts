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
  'CONTENT-CREATOR':'CONTENT_CREATOR',  // from classify.ts lowercase output
  STARTUP_FOUNDER:  'STARTUP_FOUNDER',
  'STARTUP-FOUNDER':'STARTUP_FOUNDER',  // from classify.ts lowercase output
};

export function normalizeLevel(raw: string | undefined): string {
  if (!raw) return 'MEDIUM';
  // Try exact uppercase match first (e.g. 'STAFF+', 'PRODUCTION AUDIT')
  const upper = raw.toUpperCase();
  if (LEVEL_MAP[upper]) return LEVEL_MAP[upper];
  // Try replacing spaces/hyphens with underscores as fallback
  const key = upper.replace(/-/g, '_').replace(/ /g, '_');
  return LEVEL_MAP[key] ?? 'MEDIUM';
}

export function normalizeMode(raw: string | undefined): string {
  if (!raw) return 'GENERAL';
  // Normalize: uppercase and replace hyphens with underscores
  // This handles both classify.ts output ('content-creator') and direct DB values ('CONTENT_CREATOR')
  const key = raw.toUpperCase().replace(/-/g, '_');
  return MODE_MAP[key] ?? 'GENERAL';
}
