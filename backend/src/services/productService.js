import { query } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Product Service
 * Handles product search, recommendations, and catalog queries.
 */

/**
 * Search products by category names (exact match, accent-insensitive)
 * @param {Array<string>} categoryNames - Array of category names to search
 * @param {Object} filters - Optional filters { species, limit, categoryFilters }
 * @returns {Array} - Array of product objects
 */
export async function searchProductsByCategories(categoryNames, filters = {}) {
  const { species, limit = 5, categoryFilters = {} } = filters;
  
  if (!categoryNames || categoryNames.length === 0) return [];

  // Build category conditions (accent-insensitive, case-insensitive)
  const categoryConditions = [];
  const params = [];
  let paramIdx = 1;
  
  // Identify specific subcategories (those with "/" or known patterns)
  const specificSubcategories = categoryNames.filter(cn => 
    cn.includes('/') || 
    cn.includes('ARTICULAR') || 
    cn.includes('RENAL') || 
    cn.includes('GASTROINTESTINAL') || 
    cn.includes('BUCODENTAL') || 
    cn.includes('ÓTICO') ||
    cn.includes('OTICO')
  );
  
  // Identify parent categories (SALUD, NUTRICIÓN, HIGIENE, etc.)
  const parentCategories = categoryNames.filter(cn => 
    !cn.includes('/') && 
    !cn.includes('ARTICULAR') && 
    !cn.includes('RENAL') && 
    !cn.includes('GASTROINTESTINAL') && 
    !cn.includes('BUCODENTAL') && 
    !cn.includes('ÓTICO') &&
    !cn.includes('OTICO')
  );

  for (const catName of categoryNames) {
    // Normalize: remove accents for matching (both original and normalized)
    const normalized = catName.toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    
    // Prioritize subcategory matches - check subcategory first
    categoryConditions.push(`(
      subcategory ILIKE $${paramIdx}
      OR subcategory ILIKE $${paramIdx + 1}
      OR category ILIKE $${paramIdx}
      OR category ILIKE $${paramIdx + 1}
    )`);
    // Add both original and normalized versions
    params.push(`%${catName}%`);
    params.push(`%${normalized}%`);
    paramIdx += 2;
  }

  // If we have both parent categories and specific subcategories, 
  // we want to prioritize subcategory matches but not exclude parent category matches
  // The ORDER BY will handle prioritization, so we don't need a restrictive filter here
  // Just ensure we're searching correctly

  let sql = `
    SELECT 
      id, name, brand, category, subcategory, species, price,
      product_url, add_to_cart_url, image_url, description,
      indications, requires_prescription
    FROM products
    WHERE is_active = true
      AND (${categoryConditions.join(' OR ')})
  `;
  
  // If we have specific subcategories, prioritize them in the WHERE clause
  // This ensures we get subcategory matches first, then fall back to category matches
  if (specificSubcategories.length > 0 && parentCategories.length > 0) {
    // When we have both parent category and subcategory, 
    // first try to match subcategory, then parent category
    // This is handled by ORDER BY prioritization below
  }

  // Apply category filters (e.g., for DIETA VETERINARIA, filter by name containing "renal")
  if (categoryFilters && Object.keys(categoryFilters).length > 0) {
    for (const [catKey, filter] of Object.entries(categoryFilters)) {
      const normalizedCat = catKey.toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      
      // Check if this category matches
      const catMatch = categoryNames.some(cn => {
        const norm = cn.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        return norm.includes(normalizedCat) || normalizedCat.includes(norm);
      });

      if (catMatch && filter.must_match_name_any && filter.must_match_name_any.length > 0) {
        const nameConditions = filter.must_match_name_any.map((term) => {
          params.push(`%${term.toLowerCase()}%`);
          return `LOWER(name) LIKE $${paramIdx++}`;
        });
        sql += ` AND (${nameConditions.join(' OR ')})`;
      } else if (catMatch && filter.should_match_name_any && filter.should_match_name_any.length > 0) {
        // For "should_match", filter to products that match at least one of the terms
        // This helps narrow down results within a broad category (e.g., DIETA VETERINARIA)
        const nameConditions = filter.should_match_name_any.map((term) => {
          params.push(`%${term.toLowerCase()}%`);
          return `LOWER(name) LIKE $${paramIdx++}`;
        });
        sql += ` AND (${nameConditions.join(' OR ')})`;
      }
    }
  }

  if (species) {
    sql += ` AND LOWER(species) LIKE $${paramIdx}`;
    params.push(`%${species.toLowerCase()}%`);
    paramIdx++;
  }

  // Prioritize subcategory matches - products in CONDROPROTECTOR/ARTICULAR subcategory
  // should appear before products that just match the parent category
  if (specificSubcategories.length > 0) {
    const subcatChecks = specificSubcategories.map(subcat => {
      const normalized = subcat.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      // Escape single quotes for SQL
      const escapedSubcat = subcat.replace(/'/g, "''");
      const escapedNormalized = normalized.replace(/'/g, "''");
      return `(subcategory ILIKE '%${escapedSubcat}%' OR subcategory ILIKE '%${escapedNormalized}%')`;
    }).join(' OR ');
    sql += ` ORDER BY 
      CASE 
        WHEN ${subcatChecks} THEN 1
        ELSE 2
      END,
      name ASC LIMIT $${paramIdx}`;
  } else {
    sql += ` ORDER BY name ASC LIMIT $${paramIdx}`;
  }
  params.push(limit);

  try {
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Category search error', { error: error.message, categoryNames, filters });
    return [];
  }
}

/**
 * Search products by name with synonyms
 * @param {Array<string>} synonyms - Array of synonym terms to search
 * @param {Object} filters - Optional filters { species, limit }
 * @returns {Array} - Array of product objects
 */
export async function searchProductsByNameSynonyms(synonyms, filters = {}) {
  const { species, limit = 5 } = filters;
  
  if (!synonyms || synonyms.length === 0) return [];

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  for (const synonym of synonyms) {
    // Use ILIKE for case-insensitive matching (more reliable than similarity)
    conditions.push(`(
      name ILIKE $${paramIdx}
      OR description ILIKE $${paramIdx}
      OR indications ILIKE $${paramIdx}
      OR category ILIKE $${paramIdx}
      OR subcategory ILIKE $${paramIdx}
    )`);
    params.push(`%${synonym}%`);
    paramIdx++;
  }

  let sql = `
    SELECT 
      id, name, brand, category, subcategory, species, price,
      product_url, add_to_cart_url, image_url, description,
      indications, requires_prescription
    FROM products
    WHERE is_active = true
      AND (${conditions.join(' OR ')})
  `;

  if (species) {
    sql += ` AND LOWER(species) LIKE $${paramIdx}`;
    params.push(`%${species.toLowerCase()}%`);
    paramIdx++;
  }

  sql += ` ORDER BY name ASC LIMIT $${paramIdx}`;
  params.push(limit);

  try {
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Synonym search error', { error: error.message, synonyms, filters });
    return [];
  }
}

/**
 * Intelligent product search using intent-based strategy
 * @param {string} searchTerms - Search query
 * @param {Object} intentData - Intent detection result { categoryCandidates, categoryFilters, searchStrategy, nameSynonyms }
 * @param {Object} filters - Optional filters { species, limit }
 * @returns {Array} - Array of product objects
 */
export async function searchProductsWithIntent(searchTerms, intentData, filters = {}) {
  const { categoryCandidates, categoryFilters, searchStrategy, nameSynonyms } = intentData;
  const { species, limit = 5 } = filters;

  let results = [];

  // Strategy 1: Search by categories first
  if (searchStrategy.includes('categories_first') || searchStrategy.includes('category_then_name')) {
    if (categoryCandidates && categoryCandidates.length > 0) {
      // Flatten category candidates
      const flatCategories = [];
      for (const path of categoryCandidates) {
        for (const cat of path) {
          if (!flatCategories.includes(cat)) {
            flatCategories.push(cat);
          }
        }
      }

      if (flatCategories.length > 0) {
        results = await searchProductsByCategories(flatCategories, {
          species,
          limit,
          categoryFilters
        });
        
        if (results.length > 0) {
          logger.debug('Found products by category', { 
            categories: flatCategories, 
            count: results.length 
          });
          return results;
        }
      }
    }
  }

  // Strategy 2: Search by name with synonyms
  if (searchStrategy.includes('name_with_synonyms') || searchStrategy.includes('category_then_name')) {
    const searchTermsArray = [searchTerms];
    if (nameSynonyms && nameSynonyms.length > 0) {
      searchTermsArray.push(...nameSynonyms);
    }

    results = await searchProductsByNameSynonyms(searchTermsArray, { species, limit });
    
    if (results.length > 0) {
      logger.debug('Found products by name/synonyms', { 
        terms: searchTermsArray, 
        count: results.length 
      });
      return results;
    }
  }

  // Strategy 3: Fallback to original search
  if (results.length === 0) {
    results = await searchProducts(searchTerms, { species, limit });
  }

  return results;
}

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
 * Checks ALL product mentions against the full database, not just recommended products.
 * Removes or corrects any product mentions that don't exist in the database.
 * @param {string} responseText - The AI's response text
 * @param {Array} recommendedProducts - Products that were sent as context (for URL matching)
 * @returns {string} - Corrected response text
 */
export async function validateProductNamesInResponse(responseText, recommendedProducts = []) {
  if (!responseText) return responseText;

  // Get ALL products from database for comprehensive validation
  const allProducts = await getAllProductNames();
  if (allProducts.length === 0) {
    logger.warn('No products in database for validation');
    return responseText;
  }

  // Create maps for fast lookup
  const productMap = new Map();
  const productNameLowerMap = new Map();
  allProducts.forEach(p => {
    productMap.set(p.name, p);
    productNameLowerMap.set(p.name.toLowerCase(), p.name);
  });

  // Create map of recommended products for URL matching
  const recommendedMap = new Map();
  recommendedProducts.forEach(p => {
    recommendedMap.set(p.name.toLowerCase(), p);
  });

  let correctedText = responseText;
  const lines = correctedText.split('\n');
  const invalidProducts = [];

  // Extract product mentions from the response
  // Pattern 1: Markdown links [Product Name](url)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  // Pattern 2: Bold text **Product Name**
  const boldPattern = /\*\*([^*]+)\*\*/g;
  // Pattern 3: Numbered list items "1. Product Name -"
  const numberedPattern = /^\s*\d+\.\s+([^-]+?)(?:\s*-|$)/gm;

  // Track all potential product mentions
  const productMentions = new Set();

  // Extract from markdown links
  let match;
  while ((match = linkPattern.exec(responseText)) !== null) {
    const mentionedName = match[1].trim();
    if (mentionedName.length > 3) {
      productMentions.add(mentionedName);
    }
  }

  // Extract from bold text
  while ((match = boldPattern.exec(responseText)) !== null) {
    const mentionedName = match[1].trim();
    if (mentionedName.length > 3) {
      productMentions.add(mentionedName);
    }
  }

  // Extract from numbered lists
  while ((match = numberedPattern.exec(responseText)) !== null) {
    const mentionedName = match[1].trim();
    if (mentionedName.length > 3) {
      productMentions.add(mentionedName);
    }
  }

  // Validate each mention
  for (const mentionedName of productMentions) {
    const mentionedLower = mentionedName.toLowerCase();
    
    // Check if it's an exact match (case-insensitive)
    if (productNameLowerMap.has(mentionedLower)) {
      const exactName = productNameLowerMap.get(mentionedLower);
      // Replace with exact name if different
      if (exactName !== mentionedName) {
        correctedText = correctedText.replace(
          new RegExp(escapeRegex(mentionedName), 'g'),
          exactName
        );
        logger.debug('Corrected product name', { from: mentionedName, to: exactName });
      }
      continue;
    }

    // Check for partial/fuzzy matches in recommended products
    let bestMatch = null;
    let bestScore = 0;

    for (const [dbNameLower, dbName] of productNameLowerMap.entries()) {
      // Calculate similarity score
      const score = calculateNameSimilarity(mentionedLower, dbNameLower);
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = dbName;
      }
    }

    if (bestMatch) {
      // Replace with best matching product name
      correctedText = correctedText.replace(
        new RegExp(escapeRegex(mentionedName), 'g'),
        bestMatch
      );
      logger.debug('Fuzzy matched product name', { from: mentionedName, to: bestMatch, score: bestScore });
    } else {
      // No match found - this is an invalid product
      invalidProducts.push(mentionedName);
      logger.warn('Invalid product mentioned by AI', { productName: mentionedName });
      
      // Remove the invalid product mention (remove the entire line if it's a numbered list item)
      const linePattern = new RegExp(`^\\s*\\d+\\.\\s*${escapeRegex(mentionedName)}[^\\n]*$`, 'gmi');
      correctedText = correctedText.replace(linePattern, '');
      
      // Also remove markdown links with invalid products
      const invalidLinkPattern = new RegExp(`\\[${escapeRegex(mentionedName)}\\]\\([^)]+\\)`, 'g');
      correctedText = correctedText.replace(invalidLinkPattern, '');
    }
  }

  // Clean up empty lines that might have been left
  correctedText = correctedText.split('\n')
    .filter(line => line.trim().length > 0 || line.match(/^\s*$/))
    .join('\n');

  // Update markdown links with correct URLs from recommended products
  // Create a fresh pattern for replace (since exec() modifies global regex state)
  const linkPatternForReplace = /\[([^\]]+)\]\(([^)]+)\)/g;
  correctedText = correctedText.replace(linkPatternForReplace, (match, linkText, url) => {
    const product = productMap.get(linkText) || recommendedMap.get(linkText.toLowerCase());
    if (product) {
      // Handle both snake_case (from DB) and camelCase (from formatProductCard)
      const productUrl = product.product_url || product.productUrl;
      if (productUrl) {
        return `[${linkText}](${productUrl})`;
      }
    }
    return match;
  });

  if (invalidProducts.length > 0) {
    logger.warn('Removed invalid product mentions from AI response', { 
      invalidProducts,
      responseLength: responseText.length 
    });
  }

  return correctedText.trim();
}

/**
 * Calculate similarity between two product names (0-1 scale)
 */
function calculateNameSimilarity(name1, name2) {
  // Exact match
  if (name1 === name2) return 1.0;
  
  // Check if one contains the other
  if (name1.includes(name2) || name2.includes(name1)) {
    const shorter = name1.length < name2.length ? name1 : name2;
    const longer = name1.length >= name2.length ? name1 : name2;
    return shorter.length / longer.length;
  }

  // Word-based similarity
  const words1 = name1.split(/\s+/).filter(w => w.length > 2);
  const words2 = name2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const matchingWords = words1.filter(w1 => 
    words2.some(w2 => w1.includes(w2) || w2.includes(w1))
  );
  
  return matchingWords.length / Math.max(words1.length, words2.length);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Find alternative products when exact match is not found
 * Returns products from related categories or similar names
 * @param {string} originalQuery - Original search query
 * @param {Array<string>} relatedCategories - Related category names to try
 * @param {Object} filters - Optional filters { species, limit }
 * @returns {Array} - Array of product objects (max 2-3)
 */
export async function findAlternativeProducts(originalQuery, relatedCategories = [], filters = {}) {
  const { species, limit = 3 } = filters;
  const alternatives = [];

  // Try related categories
  if (relatedCategories && relatedCategories.length > 0) {
    const categoryResults = await searchProductsByCategories(relatedCategories, {
      species,
      limit: 2
    });
    alternatives.push(...categoryResults);
  }

  // If still not enough, try broad category search
  if (alternatives.length < limit && originalQuery) {
    const broadResults = await broadCategorySearch(originalQuery, limit - alternatives.length);
    // Avoid duplicates
    const existingIds = new Set(alternatives.map(p => p.id));
    for (const product of broadResults) {
      if (!existingIds.has(product.id)) {
        alternatives.push(product);
        if (alternatives.length >= limit) break;
      }
    }
  }

  return alternatives.slice(0, limit);
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
 * Includes instructions to use exact product names but allows flexibility for alternatives.
 * @param {Array} products
 * @param {boolean} isAlternative - Whether these are alternative products (not exact match)
 * @returns {string}
 */
export function formatProductsForContext(products, isAlternative = false) {
  if (!products || products.length === 0) return '';

  let header;
  if (isAlternative) {
    header = `PRODUCTOS ALTERNATIVOS DISPONIBLES:\nNo tenemos un producto exacto, pero estas opciones podrían ser útiles. Usa el NOMBRE EXACTO tal cual aparece aquí. Explica por qué podrían servirle y ofrece más información si necesita.\n\n`;
  } else {
    header = `PRODUCTOS RELEVANTES DEL CATÁLOGO:\nEstos son productos que podrían encajar con lo que busca. Usa el NOMBRE EXACTO tal cual aparece aquí (copia y pega). Si ninguno encaja perfectamente, recomienda el MÁS SIMILAR y explica por qué podría servirle.\n\n`;
  }

  const productList = products.map((p, i) => {
    let text = `${i + 1}. NOMBRE EXACTO: "${p.name}"`;
    if (p.brand) text += `\n   Marca: ${p.brand}`;
    if (p.price) text += `\n   Precio: ${p.price}€`;
    if (p.species) text += `\n   Especie: ${p.species}`;
    if (p.category) text += `\n   Categoría: ${p.category}`;
    if (p.subcategory) text += `\n   Subcategoría: ${p.subcategory}`;
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
