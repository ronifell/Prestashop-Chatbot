import { query } from '../config/database.js';
import { normalizeText, containsKeyword, containsAllKeywords } from '../utils/textNormalizer.js';
import logger from '../utils/logger.js';

/**
 * Red Flag Detection Service
 * Detects emergency/urgent patterns in user messages.
 * Uses both database-stored patterns and hardcoded fallback patterns.
 */

// Hardcoded fallback patterns (in case DB is unavailable)
const FALLBACK_PATTERNS = {
  keyword: [
    { keywords: ['no respira'], severity: 'emergency', category: 'respiracion' },
    { keywords: ['dificultad para respirar'], severity: 'emergency', category: 'respiracion' },
    { keywords: ['se ahoga'], severity: 'emergency', category: 'respiracion' },
    { keywords: ['inconsciente'], severity: 'emergency', category: 'consciencia' },
    { keywords: ['convulsion'], severity: 'emergency', category: 'consciencia' },
    { keywords: ['convulsiones'], severity: 'emergency', category: 'consciencia' },
    { keywords: ['hemorragia'], severity: 'emergency', category: 'sangrado' },
    { keywords: ['vomita sangre'], severity: 'emergency', category: 'sangrado' },
    { keywords: ['veneno'], severity: 'emergency', category: 'envenenamiento' },
    { keywords: ['envenenado'], severity: 'emergency', category: 'envenenamiento' },
    { keywords: ['intoxicacion'], severity: 'emergency', category: 'envenenamiento' },
    { keywords: ['raticida'], severity: 'emergency', category: 'envenenamiento' },
    { keywords: ['paracetamol'], severity: 'emergency', category: 'envenenamiento' },
    { keywords: ['atropellado'], severity: 'emergency', category: 'trauma' },
    { keywords: ['fractura'], severity: 'emergency', category: 'trauma' },
    { keywords: ['no puede orinar'], severity: 'emergency', category: 'abdomen' },
    { keywords: ['bloqueo urinario'], severity: 'emergency', category: 'abdomen' },
  ],
  combined: [
    { keywords: ['vomita', 'sangre'], severity: 'emergency', category: 'combinado' },
    { keywords: ['no come', 'no bebe', 'aletargado'], severity: 'emergency', category: 'combinado' },
    { keywords: ['diarrea', 'letargo'], severity: 'emergency', category: 'combinado' },
    { keywords: ['vomita', 'sin parar'], severity: 'emergency', category: 'combinado' },
  ],
};

// In-memory cache for patterns (refreshed periodically)
let cachedPatterns = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load red flag patterns from database
 */
async function loadPatterns() {
  const now = Date.now();
  if (cachedPatterns && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedPatterns;
  }

  try {
    const result = await query(
      'SELECT pattern_type, keywords, severity, category FROM red_flag_patterns WHERE is_active = true'
    );

    cachedPatterns = {
      keyword: result.rows.filter(r => r.pattern_type === 'keyword'),
      combined: result.rows.filter(r => r.pattern_type === 'combined'),
    };
    cacheTimestamp = now;
    return cachedPatterns;
  } catch (error) {
    logger.warn('Could not load red flag patterns from DB, using fallback', { error: error.message });
    return FALLBACK_PATTERNS;
  }
}

/**
 * Detect red flags in a user message
 * @param {string} userMessage - The user's message
 * @returns {Object} - { isRedFlag: boolean, severity: string, detectedPatterns: string[], category: string }
 */
export async function detectRedFlags(userMessage) {
  const normalizedMessage = normalizeText(userMessage);
  const patterns = await loadPatterns();
  const detectedPatterns = [];
  let highestSeverity = null;
  let primaryCategory = null;

  // Check single keyword patterns
  for (const pattern of patterns.keyword) {
    for (const kw of pattern.keywords) {
      if (containsKeyword(normalizedMessage, kw)) {
        detectedPatterns.push(kw);
        if (!highestSeverity || severityLevel(pattern.severity) > severityLevel(highestSeverity)) {
          highestSeverity = pattern.severity;
          primaryCategory = pattern.category;
        }
      }
    }
  }

  // Check combined keyword patterns (ALL keywords must be present)
  for (const pattern of patterns.combined) {
    if (containsAllKeywords(normalizedMessage, pattern.keywords)) {
      detectedPatterns.push(`[combo: ${pattern.keywords.join(' + ')}]`);
      if (!highestSeverity || severityLevel(pattern.severity) > severityLevel(highestSeverity)) {
        highestSeverity = pattern.severity;
        primaryCategory = pattern.category;
      }
    }
  }

  const isRedFlag = detectedPatterns.length > 0;

  if (isRedFlag) {
    logger.info('Red flag detected', {
      severity: highestSeverity,
      category: primaryCategory,
      patterns: detectedPatterns,
      message: userMessage.substring(0, 100),
    });
  }

  return {
    isRedFlag,
    severity: highestSeverity,
    detectedPatterns,
    category: primaryCategory,
  };
}

/**
 * Invalidate the cached patterns (call after admin updates patterns)
 */
export function invalidatePatternCache() {
  cachedPatterns = null;
  cacheTimestamp = 0;
}

/**
 * Helper to compare severity levels
 */
function severityLevel(severity) {
  switch (severity) {
    case 'emergency': return 3;
    case 'urgent': return 2;
    case 'caution': return 1;
    default: return 0;
  }
}
