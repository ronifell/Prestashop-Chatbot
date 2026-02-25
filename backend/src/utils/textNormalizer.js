/**
 * Text normalization utilities for accent-free keyword matching.
 * Used primarily by the red flag detection system.
 */

/**
 * Normalize text: lowercase, remove accents, trim extra spaces
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents/diacritics
    .replace(/[^\w\s]/g, ' ')        // Replace punctuation with spaces
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
}

/**
 * Check if normalized text contains a keyword (substring match)
 * @param {string} normalizedText
 * @param {string} keyword
 * @returns {boolean}
 */
export function containsKeyword(normalizedText, keyword) {
  const normalizedKeyword = normalizeText(keyword);
  return normalizedText.includes(normalizedKeyword);
}

/**
 * Check if normalized text contains ALL keywords from an array (combined rule)
 * @param {string} normalizedText
 * @param {string[]} keywords
 * @returns {boolean}
 */
export function containsAllKeywords(normalizedText, keywords) {
  return keywords.every((kw) => containsKeyword(normalizedText, kw));
}
