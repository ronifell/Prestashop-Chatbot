import { query } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Clinic Service
 * Handles veterinary clinic lookup by postal code.
 */

/**
 * Find clinics by postal code (exact match)
 * @param {string} postalCode - 5-digit Spanish postal code
 * @returns {Array} - Array of clinic objects
 */
export async function findClinicsByPostalCode(postalCode) {
  const cleanCode = postalCode.replace(/\s/g, '').substring(0, 5);

  const result = await query(
    `SELECT id, name, address, city, province, postal_code, phone, email, website, is_emergency, notes
     FROM vet_clinics
     WHERE postal_code = $1 AND is_active = true
     ORDER BY is_emergency DESC, name ASC`,
    [cleanCode]
  );

  if (result.rows.length > 0) {
    logger.info('Clinics found by postal code', { postalCode: cleanCode, count: result.rows.length });
    return result.rows;
  }

  // If no exact match, try prefix match (first 2 digits = province)
  const provincePrefix = cleanCode.substring(0, 2);
  const resultProvince = await query(
    `SELECT id, name, address, city, province, postal_code, phone, email, website, is_emergency, notes
     FROM vet_clinics
     WHERE postal_code LIKE $1 AND is_active = true
     ORDER BY is_emergency DESC, name ASC
     LIMIT 5`,
    [`${provincePrefix}%`]
  );

  logger.info('Clinics found by province prefix', { prefix: provincePrefix, count: resultProvince.rows.length });
  return resultProvince.rows;
}

/**
 * Format clinics for chat display
 * @param {Array} clinics
 * @returns {string}
 */
export function formatClinicsForChat(clinics) {
  if (!clinics || clinics.length === 0) {
    return 'Lo sentimos, no tenemos clínicas colaboradoras registradas en tu zona actualmente. Te recomendamos buscar "urgencias veterinarias" junto con tu localidad en Google.';
  }

  let text = '🏥 **Clínicas veterinarias colaboradoras en tu zona:**\n\n';
  clinics.forEach((c, i) => {
    text += `${i + 1}. **${c.name}**`;
    if (c.is_emergency) text += ' 🚨 (Urgencias)';
    text += '\n';
    if (c.address) text += `   📍 ${c.address}`;
    if (c.city) text += `, ${c.city}`;
    if (c.province) text += ` (${c.province})`;
    text += '\n';
    if (c.phone) text += `   📞 ${c.phone}\n`;
    if (c.email) text += `   ✉️ ${c.email}\n`;
    if (c.website) text += `   🌐 ${c.website}\n`;
    text += '\n';
  });

  return text;
}

/**
 * Detect if user message contains a postal code
 * @param {string} message
 * @returns {string|null} - Postal code or null
 */
export function extractPostalCode(message) {
  // Spanish postal codes are 5 digits, 01000-52999
  const match = message.match(/\b(\d{5})\b/);
  if (match) {
    const code = match[1];
    const prefix = parseInt(code.substring(0, 2), 10);
    // Valid Spanish postal code prefixes: 01-52
    if (prefix >= 1 && prefix <= 52) {
      return code;
    }
  }
  return null;
}

/**
 * Format clinic as card object for frontend
 */
export function formatClinicCard(clinic) {
  return {
    id: clinic.id,
    name: clinic.name,
    address: clinic.address,
    city: clinic.city,
    province: clinic.province,
    postalCode: clinic.postal_code,
    phone: clinic.phone,
    email: clinic.email,
    website: clinic.website,
    isEmergency: clinic.is_emergency,
  };
}

/**
 * Get total active clinic count
 */
export async function getClinicCount() {
  const result = await query('SELECT COUNT(*) FROM vet_clinics WHERE is_active = true');
  return parseInt(result.rows[0].count, 10);
}
