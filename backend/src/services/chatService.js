import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../config/database.js';
import { detectRedFlags } from './redFlagService.js';
import { getTemplate, getWelcomeMessage } from './templateService.js';
import { searchProducts, formatProductsForContext, formatProductCard, broadCategorySearch, validateProductNamesInResponse, getProductsBySpecies } from './productService.js';
import { findClinicsByPostalCode, formatClinicsForChat, extractPostalCode, formatClinicCard } from './clinicService.js';
import { searchVademecums } from './vademecumService.js';
import { generateChatResponse } from './openaiService.js';
import { normalizeText, containsKeyword } from '../utils/textNormalizer.js';
import logger from '../utils/logger.js';

/**
 * Main Chat Service
 * Orchestrates the full chat flow: red flag detection → template responses → OpenAI → product search → clinic lookup
 */

// Patterns that suggest user wants medical advice (triggers medical_limit)
const MEDICAL_REQUEST_PATTERNS = [
  'que dosis', 'cuanta dosis', 'dosis recomendada',
  'que le doy', 'que medicamento', 'que le puedo dar',
  'diagnostico', 'diagnosticar', 'que enfermedad tiene',
  'que le pasa', 'que tiene mi', 'esta enfermo',
  'recetame', 'prescribeme', 'necesito receta',
  'sustituir medicamento', 'cambiar medicamento', 'alternativa a',
  'interpretar analisis', 'interpretar resultados',
];

// Patterns that suggest prescription medication inquiry
const RX_PATTERNS = [
  'receta', 'prescripcion', 'medicamento con receta',
  'necesita receta', 'requiere receta',
  'antibiotico', 'corticoide', 'antiinflamatorio con receta',
];

/**
 * Process a user message through the full chat pipeline
 * @param {Object} params
 * @param {string} params.sessionId - Session identifier
 * @param {string} params.message - User message
 * @param {string} params.conversationId - Existing conversation ID (optional)
 * @param {Object} params.productContext - Current product page context (optional)
 * @returns {Object} - Chat response
 */
export async function processMessage({ sessionId, message, conversationId, productContext }) {
  const startTime = Date.now();

  // 1. Get or create conversation
  const convId = conversationId || await createConversation(sessionId, productContext);

  // 2. Save user message
  await saveMessage(convId, 'user', message);

  // 3. Check for postal code (clinic lookup)
  const postalCode = extractPostalCode(message);
  if (postalCode) {
    const clinicResponse = await handlePostalCodeLookup(convId, postalCode);
    return {
      conversationId: convId,
      ...clinicResponse,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 4. Red flag detection - BEFORE calling OpenAI
  const redFlagResult = await detectRedFlags(message);

  if (redFlagResult.isRedFlag) {
    const emergencyResponse = await handleRedFlag(convId, redFlagResult);
    return {
      conversationId: convId,
      ...emergencyResponse,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 5. Check for medical request patterns (limit template)
  const normalizedMsg = normalizeText(message);
  const isMedicalRequest = MEDICAL_REQUEST_PATTERNS.some(p => containsKeyword(normalizedMsg, p));
  if (isMedicalRequest) {
    const medicalResponse = await handleMedicalLimit(convId);
    return {
      conversationId: convId,
      ...medicalResponse,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 6. Check for prescription medication inquiry
  const isRxInquiry = RX_PATTERNS.some(p => containsKeyword(normalizedMsg, p));
  if (isRxInquiry) {
    const rxResponse = await handleRxLimit(convId);
    return {
      conversationId: convId,
      ...rxResponse,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 7. Search for relevant products in catalog
  let catalogContext = '';
  let recommendedProducts = [];
  try {
    // Extract species from message for better search
    const speciesFilter = extractSpeciesFromMessage(message);
    
    let products = await searchProducts(message, { 
      limit: 5,
      ...(speciesFilter && { species: speciesFilter })
    });

    // If no products found with primary search, try broader category search
    if (products.length === 0) {
      logger.info('No products found with primary search, trying broad category search', { message });
      products = await broadCategorySearch(message, 5);
    }

    // If still no products and we detected a species, try searching by species only
    if (products.length === 0 && speciesFilter) {
      logger.info('No products found, trying species-only search', { species: speciesFilter });
      products = await getProductsBySpecies(speciesFilter, 5);
    }

    if (products.length > 0) {
      catalogContext = formatProductsForContext(products);
      recommendedProducts = products.map(formatProductCard);
    }
  } catch (err) {
    logger.warn('Product search failed during chat', { error: err.message });
  }

  // 8. Search vademecums for technical info
  let vademecumContext = '';
  try {
    const vademecumResults = await searchVademecums(message);
    if (vademecumResults.length > 0) {
      vademecumContext = vademecumResults
        .map(v => `[${v.name}]: ${v.content}`)
        .join('\n\n');
    }
  } catch (err) {
    logger.warn('Vademecum search failed during chat', { error: err.message });
  }

  // 9. Build conversation history for OpenAI
  const history = await getConversationHistory(convId);

  // 10. Format product context string
  let productCtxStr = '';
  if (productContext) {
    productCtxStr = `Producto: ${productContext.name || ''}. Precio: ${productContext.price || ''}€. Categoría: ${productContext.category || ''}. Descripción: ${productContext.description || ''}`;
  }

  // 11. Call OpenAI
  const aiResponse = await generateChatResponse(
    history,
    productCtxStr,
    catalogContext,
    vademecumContext
  );

  // 12. Post-validate: ensure product names in the response match DB exactly
  let validatedMessage = aiResponse.message;
  if (recommendedProducts.length > 0) {
    try {
      validatedMessage = await validateProductNamesInResponse(
        aiResponse.message,
        recommendedProducts
      );
    } catch (err) {
      logger.warn('Product name validation failed, using original response', { error: err.message });
    }
  }

  // 13. Filter product cards: only show products the AI actually mentioned in its response.
  //     If the AI asked a clarifying question (e.g. "Dime raza, años...") without
  //     recommending specific products, do NOT show product cards to the user.
  const mentionedProducts = filterMentionedProducts(validatedMessage, recommendedProducts);

  // 14. Save assistant response
  const productIds = mentionedProducts.map(p => p.id);
  await saveMessage(convId, 'assistant', validatedMessage, {
    responseType: 'normal',
    tokensUsed: aiResponse.tokensUsed,
    processingTimeMs: aiResponse.processingTimeMs,
    productsRecommended: productIds,
  });

  // 15. Update conversation
  await updateConversation(convId);

  return {
    conversationId: convId,
    message: validatedMessage,
    responseType: 'normal',
    products: mentionedProducts,
    clinics: [],
    tokensUsed: aiResponse.tokensUsed,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Filter product cards to only include products the AI actually mentioned in its response.
 * This prevents showing product cards when the AI is asking clarifying questions
 * (e.g. "Dime raza, años y si tiene alguna patología") without recommending anything.
 * @param {string} responseText - The AI's response text
 * @param {Array} products - All products that were sent as context
 * @returns {Array} - Only products that are referenced in the response
 */
function filterMentionedProducts(responseText, products) {
  if (!responseText || !products || products.length === 0) return [];

  const responseLower = responseText.toLowerCase();

  // Check if the response contains any product-related content
  // (links, product names, prices, etc.)
  const hasProductLinks = responseText.includes('](http') || responseText.includes('](https');
  const hasProductMention = products.some(p => {
    const nameLower = p.name.toLowerCase();
    // Check for exact name match
    if (responseLower.includes(nameLower)) return true;
    // Check for significant words from the product name (at least 3 words matching)
    const nameWords = nameLower.split(/\s+/).filter(w => w.length > 3);
    if (nameWords.length >= 2) {
      const matchCount = nameWords.filter(w => responseLower.includes(w)).length;
      return matchCount >= Math.ceil(nameWords.length * 0.6);
    }
    return false;
  });

  // If the AI didn't mention any products, return empty array (no cards)
  if (!hasProductLinks && !hasProductMention) {
    logger.debug('AI response does not mention products — suppressing product cards');
    return [];
  }

  // Return only the products that are actually mentioned
  return products.filter(p => {
    const nameLower = p.name.toLowerCase();
    // Exact name match in response
    if (responseLower.includes(nameLower)) return true;
    // Significant word overlap
    const nameWords = nameLower.split(/\s+/).filter(w => w.length > 3);
    if (nameWords.length >= 2) {
      const matchCount = nameWords.filter(w => responseLower.includes(w)).length;
      return matchCount >= Math.ceil(nameWords.length * 0.6);
    }
    return false;
  });
}

/**
 * Handle red flag detection → emergency response
 */
async function handleRedFlag(conversationId, redFlagResult) {
  const template = getTemplate('emergency_warning');

  // Mark conversation as emergency
  await query(
    'UPDATE conversations SET has_emergency = true WHERE id = $1',
    [conversationId]
  );

  await saveMessage(conversationId, 'assistant', template.message, {
    responseType: 'emergency_warning',
    redFlagsDetected: redFlagResult.detectedPatterns,
  });

  logger.warn('EMERGENCY RED FLAG', {
    conversationId,
    severity: redFlagResult.severity,
    patterns: redFlagResult.detectedPatterns,
    category: redFlagResult.category,
  });

  return {
    message: template.message,
    responseType: 'emergency_warning',
    severity: redFlagResult.severity,
    products: [],
    clinics: [],
    awaitingPostalCode: true,
  };
}

/**
 * Handle medical limit request
 */
async function handleMedicalLimit(conversationId) {
  const template = getTemplate('medical_limit');
  await saveMessage(conversationId, 'assistant', template.message, {
    responseType: 'medical_limit',
  });

  return {
    message: template.message,
    responseType: 'medical_limit',
    products: [],
    clinics: [],
    awaitingPostalCode: true,
  };
}

/**
 * Handle prescription medication inquiry
 */
async function handleRxLimit(conversationId) {
  const template = getTemplate('rx_limit');
  await saveMessage(conversationId, 'assistant', template.message, {
    responseType: 'rx_limit',
  });

  return {
    message: template.message,
    responseType: 'rx_limit',
    products: [],
    clinics: [],
    awaitingPostalCode: true,
  };
}

/**
 * Handle postal code lookup for clinic recommendations
 */
async function handlePostalCodeLookup(conversationId, postalCode) {
  const result = await findClinicsByPostalCode(postalCode);
  const { clinics, isExactMatch } = result;

  // If no exact match, return the specific message requesting email
  if (!isExactMatch) {
    const noClinicMessage = '¡Ups! 🐾\n\nTodavía no hemos evaluado ninguna clínica veterinaria en tu zona para poder recomendártela con total confianza.\n\nSi quieres, déjanos tu email y te avisamos en cuanto una clínica de tu área supere nuestro control de calidad ✅✨\n\nAsí serás el primero en enterarte.';
    
    await saveMessage(conversationId, 'assistant', noClinicMessage, {
      responseType: 'clinic_recommendation',
    });

    return {
      message: noClinicMessage,
      responseType: 'clinic_recommendation',
      products: [],
      clinics: [],
    };
  }

  // If exact match found, format and return clinics
  const clinicText = formatClinicsForChat(clinics);
  const clinicCards = clinics.map(formatClinicCard);

  await saveMessage(conversationId, 'assistant', clinicText, {
    responseType: 'clinic_recommendation',
  });

  return {
    message: clinicText,
    responseType: 'clinic_recommendation',
    products: [],
    clinics: clinicCards,
  };
}

/**
 * Create a new conversation
 */
async function createConversation(sessionId, productContext) {
  const id = uuidv4();
  await query(
    'INSERT INTO conversations (id, session_id, product_context) VALUES ($1, $2, $3)',
    [id, sessionId, productContext ? JSON.stringify(productContext) : null]
  );
  return id;
}

/**
 * Update conversation metadata
 */
async function updateConversation(conversationId) {
  await query(
    `UPDATE conversations
     SET last_message_at = NOW(), message_count = message_count + 1
     WHERE id = $1`,
    [conversationId]
  );
}

/**
 * Save a message to the database
 */
async function saveMessage(conversationId, role, content, options = {}) {
  const {
    responseType = null,
    redFlagsDetected = null,
    productsRecommended = null,
    tokensUsed = null,
    processingTimeMs = null,
  } = options;

  await query(
    `INSERT INTO messages (conversation_id, role, content, response_type, red_flags_detected, products_recommended, tokens_used, processing_time_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      conversationId,
      role,
      content,
      responseType,
      redFlagsDetected,
      productsRecommended,
      tokensUsed,
      processingTimeMs,
    ]
  );
}

/**
 * Get conversation history for OpenAI context
 */
async function getConversationHistory(conversationId) {
  const result = await query(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return result.rows;
}

/**
 * Extract species (dog/cat) from user message for better product search
 * @param {string} message - User message
 * @returns {string|null} - Species filter or null
 */
function extractSpeciesFromMessage(message) {
  const normalized = normalizeText(message);
  
  // Dog-related keywords
  const dogKeywords = ['perro', 'perra', 'can', 'canino', 'yorkshire', 'terrier', 'labrador', 'pastor', 'bulldog', 'chihuahua', 'beagle', 'doberman', 'rottweiler', 'husky', 'golden', 'mestizo perro'];
  // Cat-related keywords
  const catKeywords = ['gato', 'gata', 'felino', 'persa', 'siames', 'british', 'scottish', 'maine', 'ragdoll', 'mestizo gato'];
  
  const hasDog = dogKeywords.some(keyword => containsKeyword(normalized, keyword));
  const hasCat = catKeywords.some(keyword => containsKeyword(normalized, keyword));
  
  if (hasDog && !hasCat) return 'perro';
  if (hasCat && !hasDog) return 'gato';
  
  return null;
}

/**
 * Get the welcome message for new sessions
 */
export function getWelcome() {
  return getWelcomeMessage();
}
