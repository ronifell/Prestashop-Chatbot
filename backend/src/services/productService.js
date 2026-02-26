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
      ts_rank(search_vector, plainto_tsquery('spanish', $1)) AS relevance
    FROM products
    WHERE is_active = true
  `;
  const params = [searchTerms];
  let paramIdx = 2;

  // Full-text search OR trigram similarity
  sql += ` AND (
    search_vector @@ plainto_tsquery('spanish', $1)
    OR similarity(name, $1) > 0.2
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

  sql += ` ORDER BY relevance DESC, name ASC LIMIT $${paramIdx}`;
  params.push(limit);

  try {
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Product search error', { error: error.message, searchTerms, filters });
    // Fallback: simple ILIKE search
    return fallbackSearch(searchTerms, limit);
  }
}

/**
 * Fallback simple search when full-text search fails
 */
async function fallbackSearch(searchTerms, limit = 5) {
  const sql = `
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
      )
    ORDER BY name ASC
    LIMIT $2
  `;
  const result = await query(sql, [`%${searchTerms.toLowerCase()}%`, limit]);
  return result.rows;
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
 * Format product data for the AI context
 * @param {Array} products
 * @returns {string}
 */
export function formatProductsForContext(products) {
  if (!products || products.length === 0) return '';

  return products.map((p, i) => {
    let text = `${i + 1}. **${p.name}**`;
    if (p.brand) text += ` (${p.brand})`;
    if (p.price) text += ` — ${p.price}€`;
    if (p.species) text += ` | Especie: ${p.species}`;
    if (p.category) text += ` | Categoría: ${p.category}`;
    if (p.product_url) text += `\n   Enlace: ${p.product_url}`;
    if (p.indications) text += `\n   Indicaciones: ${p.indications}`;
    if (p.requires_prescription) text += '\n   ⚠️ Requiere receta veterinaria';
    return text;
  }).join('\n\n');
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
