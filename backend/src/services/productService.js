import { query } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Product Service
 * Handles product search, recommendations, and catalog queries.
 */

/**
 * Search products using full-text search (Spanish)
 * @param {string} searchTerms - Search query
 * @param {Object} filters - Optional filters { species, category, maxPrice, limit }
 * @returns {Array} - Array of product objects
 */
export async function searchProducts(searchTerms, filters = {}) {
  const { species, category, maxPrice, limit = 5 } = filters;

  let sql = `
    SELECT 
      id, name, brand, category, subcategory, species, price,
      product_url, add_to_cart_url, image_url, description,
      indications, requires_prescription,
      ts_rank(search_vector, plainto_tsquery('spanish', $1)) AS relevance,
      similarity(name, $1) AS name_similarity
    FROM products
    WHERE is_active = true
  `;
  const params = [searchTerms];
  let paramIdx = 2;

  // Full-text search OR trigram similarity (lowered threshold for broader matching)
  sql += ` AND (
    search_vector @@ plainto_tsquery('spanish', $1)
    OR similarity(name, $1) > 0.15
    OR similarity(category, $1) > 0.2
    OR similarity(description, $1) > 0.15
  )`;

  if (species) {
    sql += ` AND LOWER(species) LIKE $${paramIdx}`;
    params.push(`%${species.toLowerCase()}%`);
    paramIdx++;
  }

  if (category) {
    sql += ` AND LOWER(category) LIKE $${paramIdx}`;
    params.push(`%${category.toLowerCase()}%`);
    paramIdx++;
  }

  if (maxPrice) {
    sql += ` AND price <= $${paramIdx}`;
    params.push(maxPrice);
    paramIdx++;
  }

  sql += ` ORDER BY relevance DESC, name_similarity DESC, name ASC LIMIT $${paramIdx}`;
  params.push(limit);

  try {
    const result = await query(sql, params);
    if (result.rows.length > 0) {
      return result.rows;
    }
    // If no results from full-text + trigram, try broader fallback
    return fallbackSearch(searchTerms, limit);
  } catch (error) {
    logger.error('Product search error', { error: error.message, searchTerms, filters });
    // Fallback: simple ILIKE search
    return fallbackSearch(searchTerms, limit);
  }
}

/**
 * Fallback simple search when full-text search fails.
 * Uses ILIKE on multiple fields and also word-level matching.
 */
async function fallbackSearch(searchTerms, limit = 5) {
  // Split search into individual words for broader matching
  const words = searchTerms.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  let sql = `
    SELECT id, name, brand, category, species, price,
           product_url, add_to_cart_url, image_url, description,
           indications, requires_prescription
    FROM products
    WHERE is_active = true
      AND (
        LOWER(name) LIKE $1
        OR LOWER(category) LIKE $1
        OR LOWER(description) LIKE $1
        OR LOWER(indications) LIKE $1
        OR LOWER(species) LIKE $1
  `;
  const params = [`%${searchTerms.toLowerCase()}%`];
  let paramIdx = 2;

  // Add individual word matching for broader results
  for (const word of words) {
    sql += ` OR LOWER(name) LIKE $${paramIdx}`;
    sql += ` OR LOWER(category) LIKE $${paramIdx}`;
    sql += ` OR LOWER(indications) LIKE $${paramIdx}`;
    params.push(`%${word}%`);
    paramIdx++;
  }

  sql += `
      )
    ORDER BY name ASC
    LIMIT $${paramIdx}
  `;
  params.push(limit);

  try {
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Fallback search error', { error: error.message, searchTerms });
    return [];
  }
}

/**
 * Broad category-based search: finds products in related categories.
 * Used as a last resort when specific searches return nothing,
 * so the AI always has real products to recommend.
 * @param {string} searchTerms - Original search query
 * @param {number} limit - Max results
 * @returns {Array}
 */
export async function broadCategorySearch(searchTerms, limit = 5) {
  const words = searchTerms.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return [];

  let conditions = words.map((_, i) => `(
    LOWER(category) LIKE $${i + 1}
    OR LOWER(subcategory) LIKE $${i + 1}
    OR LOWER(species) LIKE $${i + 1}
  )`);

  const sql = `
    SELECT id, name, brand, category, subcategory, species, price,
           product_url, add_to_cart_url, image_url, description,
           indications, requires_prescription
    FROM products
    WHERE is_active = true
      AND (${conditions.join(' OR ')})
    ORDER BY name ASC
    LIMIT $${words.length + 1}
  `;
  const params = [...words.map(w => `%${w}%`), limit];

  try {
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Broad category search error', { error: error.message });
    return [];
  }
}

/**
 * Get all active product names from the database.
 * Used for post-validation of AI responses.
 * @returns {Array<{id: number, name: string, product_url: string}>}
 */
export async function getAllProductNames() {
  try {
    const result = await query(
      'SELECT id, name, product_url FROM products WHERE is_active = true ORDER BY name ASC'
    );
    return result.rows;
  } catch (error) {
    logger.error('Error fetching product names', { error: error.message });
    return [];
  }
}

/**
 * Validate and correct product names in the AI response.
 * If the AI mentioned a product name that doesn't exactly match the DB,
 * find the closest matching product name from the DB and replace it.
 * @param {string} responseText - The AI's response text
 * @param {Array} recommendedProducts - Products that were sent as context
 * @returns {string} - Corrected response text
 */
export async function validateProductNamesInResponse(responseText, recommendedProducts) {
  if (!responseText || !recommendedProducts || recommendedProducts.length === 0) {
    return responseText;
  }

  const allProducts = await getAllProductNames();
  if (allProducts.length === 0) return responseText;

  const allProductNames = allProducts.map(p => p.name);

  let correctedText = responseText;

  // Check each recommended product — if the AI used a slightly different name,
  // replace it with the exact DB name
  for (const product of recommendedProducts) {
    const exactName = product.name;
    // The product name should appear in the response; if it does, it's correct
    if (correctedText.includes(exactName)) continue;

    // Check if the AI used a shortened or modified version of the name
    // by looking for partial matches of the DB product name in the response
    const nameWords = exactName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (nameWords.length < 2) continue;

    // Look for sequences in the response that partially match this product name
    // (AI might have abbreviated it)
    const lines = correctedText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      const matchingWords = nameWords.filter(w => lineLower.includes(w));
      // If more than half the significant words match, replace with exact name
      if (matchingWords.length >= Math.ceil(nameWords.length * 0.5) && matchingWords.length >= 2) {
        // Find the approximate position and replace with exact name + link
        // Look for markdown links or bold text that might contain the modified name
        const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        while ((match = linkPattern.exec(lines[i])) !== null) {
          const linkText = match[1].toLowerCase();
          const linkMatchWords = nameWords.filter(w => linkText.includes(w));
          if (linkMatchWords.length >= Math.ceil(nameWords.length * 0.5) && linkMatchWords.length >= 2) {
            const productUrl = product.product_url || match[2];
            lines[i] = lines[i].replace(match[0], `[${exactName}](${productUrl})`);
          }
        }
      }
    }
    correctedText = lines.join('\n');
  }

  return correctedText;
}

/**
 * Get product by ID
 */
export async function getProductById(productId) {
  const result = await query(
    'SELECT * FROM products WHERE id = $1 AND is_active = true',
    [productId]
  );
  return result.rows[0] || null;
}

/**
 * Get products by category
 */
export async function getProductsByCategory(category, limit = 10) {
  const result = await query(
    `SELECT id, name, brand, category, species, price, product_url, add_to_cart_url, image_url, description, indications, requires_prescription
     FROM products
     WHERE is_active = true AND LOWER(category) LIKE $1
     ORDER BY name ASC LIMIT $2`,
    [`%${category.toLowerCase()}%`, limit]
  );
  return result.rows;
}

/**
 * Get products by species
 */
export async function getProductsBySpecies(species, limit = 10) {
  const result = await query(
    `SELECT id, name, brand, category, species, price, product_url, add_to_cart_url, image_url, description, indications, requires_prescription
     FROM products
     WHERE is_active = true AND LOWER(species) LIKE $1
     ORDER BY name ASC LIMIT $2`,
    [`%${species.toLowerCase()}%`, limit]
  );
  return result.rows;
}

/**
 * Format product data for the AI context.
 * Includes strict instructions to use only these exact product names.
 * @param {Array} products
 * @returns {string}
 */
export function formatProductsForContext(products) {
  if (!products || products.length === 0) return '';

  let header = `IMPORTANTE: Estos son los ÚNICOS productos que puedes recomendar. Usa el NOMBRE EXACTO tal cual aparece aquí (copia y pega). Si ninguno encaja exactamente con lo que busca el cliente, recomienda el MÁS SIMILAR de esta lista y explica por qué podría servirle.\n\n`;

  const productList = products.map((p, i) => {
    let text = `${i + 1}. NOMBRE EXACTO: "${p.name}"`;
    if (p.brand) text += `\n   Marca: ${p.brand}`;
    if (p.price) text += `\n   Precio: ${p.price}€`;
    if (p.species) text += `\n   Especie: ${p.species}`;
    if (p.category) text += `\n   Categoría: ${p.category}`;
    if (p.product_url) text += `\n   Enlace: ${p.product_url}`;
    if (p.description) text += `\n   Descripción: ${p.description.substring(0, 200)}`;
    if (p.indications) text += `\n   Indicaciones: ${p.indications}`;
    if (p.requires_prescription) text += '\n   ⚠️ Requiere receta veterinaria';
    return text;
  }).join('\n\n');

  return header + productList;
}

/**
 * Format product as a card object for frontend rendering
 */
export function formatProductCard(product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    price: product.price,
    species: product.species,
    category: product.category,
    imageUrl: product.image_url,
    productUrl: product.product_url,
    addToCartUrl: product.add_to_cart_url,
    requiresPrescription: product.requires_prescription,
    indications: product.indications,
  };
}

/**
 * Get total active product count
 */
export async function getProductCount() {
  const result = await query('SELECT COUNT(*) FROM products WHERE is_active = true');
  return parseInt(result.rows[0].count, 10);
}
