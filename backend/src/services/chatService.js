import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../config/database.js';
import { detectRedFlags } from './redFlagService.js';
import { getTemplate, getWelcomeMessage } from './templateService.js';
import { 
  searchProducts, 
  searchProductsWithIntent,
  findAlternativeProducts,
  formatProductsForContext, 
  formatProductCard, 
  broadCategorySearch, 
  validateProductNamesInResponse 
} from './productService.js';
import { detectIntent, getNormalizedCategoryNames, isSupportIntent } from './intentService.js';
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
// IMPORTANT: These should only trigger for actual diagnosis/prescription requests, NOT for educational questions
const MEDICAL_REQUEST_PATTERNS = [
  'que dosis', 'cuanta dosis', 'dosis recomendada', 'cuanta cantidad',
  'que medicamento le doy', 'que medicamento darle',
  'diagnostico', 'diagnosticar', 'que enfermedad tiene',
  'que le pasa', 'que tiene mi', 'esta enfermo',
  'recetame', 'prescribeme', 'necesito receta',
  'sustituir medicamento', 'cambiar medicamento',
  'interpretar analisis', 'interpretar resultados',
  // Note: Questions about composition, general info (e.g., "qué debe tener un pienso para diabetes") 
  // are NOT blocked - they are educational and allowed
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
  // BUT: Allow educational questions (e.g., "qué composición debe tener", "qué características")
  const normalizedMsg = normalizeText(message);
  
  // Check if it's an educational question (should NOT be blocked)
  const isEducationalQuestion = containsKeyword(normalizedMsg, 'composicion') || 
                                containsKeyword(normalizedMsg, 'caracteristicas') ||
                                containsKeyword(normalizedMsg, 'debe tener') ||
                                containsKeyword(normalizedMsg, 'deberia tener') ||
                                containsKeyword(normalizedMsg, 'informacion general');
  
  // Only block if it's a medical request AND not an educational question
  if (!isEducationalQuestion) {
    const isMedicalRequest = MEDICAL_REQUEST_PATTERNS.some(p => containsKeyword(normalizedMsg, p));
    if (isMedicalRequest) {
      const medicalResponse = await handleMedicalLimit(convId);
      return {
        conversationId: convId,
        ...medicalResponse,
        processingTimeMs: Date.now() - startTime,
      };
    }
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

  // 7. Build conversation history for OpenAI (needed for product search context)
  const history = await getConversationHistory(convId);

  // 8. Detect intent and search for relevant products in catalog
  let catalogContext = '';
  let recommendedProducts = [];
  let hasAlternatives = false;
  try {
    // Detect intent from user message
    const intentData = detectIntent(message);
    logger.debug('Intent detected', { 
      intent: intentData.intent, 
      message: message.substring(0, 100),
      categoryCandidates: intentData.categoryCandidates,
      searchStrategy: intentData.searchStrategy
    });

    // Extract search terms from conversation history
    const searchTerms = extractSearchTermsFromConversation(history, message);
    
    // Extract species from conversation if available
    const species = extractSpeciesFromConversation(history, message);

    let products = [];

    // Use intent-based search if intent is detected
    if (intentData.intent && intentData.intent !== 'SUPPORT_SHOP') {
      products = await searchProductsWithIntent(searchTerms, intentData, {
        species,
        limit: 5
      });

      // If no products found, try to find alternatives
      if (products.length === 0) {
        logger.info('No products found with intent search, looking for alternatives', { 
          intent: intentData.intent,
          categoryCandidates: intentData.categoryCandidates
        });
        
        // Get related categories for alternatives
        const relatedCategories = getNormalizedCategoryNames(intentData.categoryCandidates);
        products = await findAlternativeProducts(searchTerms, relatedCategories, {
          species,
          limit: 3
        });
        hasAlternatives = products.length > 0;
      }
    } else {
      // Fallback to standard search
      products = await searchProducts(searchTerms, { species, limit: 5 });
      
      // If still no results, try broad category search
      if (products.length === 0) {
        logger.info('No products found with primary search, trying broad category search', { searchTerms });
        products = await broadCategorySearch(searchTerms, 5);
        hasAlternatives = products.length > 0;
      }
    }

    if (products.length > 0) {
      catalogContext = formatProductsForContext(products, hasAlternatives);
      recommendedProducts = products.map(formatProductCard);
      
      // Extract category information from products
      // Note: Currently using category names since category_id mapping from PrestaShop
      // hasn't been bootstrapped yet (see Fix.md lines 843-845)
      // TODO: Once category_name → category_id map is built, use actual PrestaShop category IDs
      const categoryNames = [...new Set(products.map(p => p.category).filter(Boolean))];
      const topIds = products.map(p => p.id);
      
      // Log as specified in Fix.md line 846: {intent, query, category_ids, results_count, top_ids}
      // Currently logging category names until PrestaShop category_id mapping is implemented
      logger.info('Product search completed', {
        intent: intentData.intent || 'none',
        query: searchTerms,
        category_ids: categoryNames, // TODO: Replace with actual PrestaShop category IDs after bootstrap
        category_names: categoryNames, // Category names for reference
        results_count: products.length,
        top_ids: topIds,
        isAlternative: hasAlternatives,
        species: species || 'none',
        search_strategy: intentData.searchStrategy || []
      });
    } else {
      // Log even when no results found
      logger.info('No products found after all search strategies', { 
        intent: intentData.intent || 'none',
        query: searchTerms,
        category_ids: [], // Empty array when no results
        results_count: 0,
        top_ids: [],
        category_candidates: intentData.categoryCandidates || [],
        search_strategy: intentData.searchStrategy || []
      });
    }
  } catch (err) {
    logger.warn('Product search failed during chat', { error: err.message });
  }

  // 9. Search vademecums for technical info
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

  // 13. Filter product cards: show products that the AI mentioned, or if products were found
  //     and the AI is asking clarifying questions, show them anyway so the user can see options.
  //     This improves UX by showing relevant products even when the bot needs more info.
  let mentionedProducts = filterMentionedProducts(validatedMessage, recommendedProducts);
  
  // If no products were mentioned but we have products and the AI is asking a question,
  // show the products anyway (user can see options while providing more info)
  if (mentionedProducts.length === 0 && recommendedProducts.length > 0) {
    // Check if the response is asking a question (contains question marks and common question words)
    const isAskingQuestion = /[¿?]/.test(validatedMessage) && 
      /\b(es|tiene|quiere|busca|necesita|dime|cuéntame|puedes|me puedes|cuál|qué|cuánto|cuánta)\b/i.test(validatedMessage);
    
    if (isAskingQuestion) {
      // Show up to 3 products when asking questions, so user can see options
      mentionedProducts = recommendedProducts.slice(0, 3);
      logger.debug('Showing products while AI asks clarifying question', { 
        productCount: mentionedProducts.length 
      });
    }
  }

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
 * Extract species from conversation
 * @param {Array} history - Conversation history
 * @param {string} currentMessage - Current message
 * @returns {string|null} - Species (perro/gato) or null
 */
function extractSpeciesFromConversation(history, currentMessage) {
  const combined = `${history.map(m => m.content).join(' ')} ${currentMessage}`.toLowerCase();
  
  if (combined.includes('perro') || combined.includes('can') || combined.includes('perros')) {
    return 'perro';
  }
  if (combined.includes('gato') || combined.includes('felino') || combined.includes('gatos')) {
    return 'gato';
  }
  return null;
}

/**
 * Extract relevant search terms from conversation history
 * Combines context from previous messages with current message to build better product search queries
 * @param {Array} history - Conversation history array with { role, content }
 * @param {string} currentMessage - Current user message
 * @returns {string} - Optimized search query string
 */
function extractSearchTermsFromConversation(history, currentMessage) {
  // Combine all user messages to extract relevant keywords
  const allUserMessages = history
    .filter(msg => msg.role === 'user')
    .map(msg => msg.content)
    .join(' ');
  
  const combined = `${allUserMessages} ${currentMessage}`.toLowerCase();
  
  // Extract species
  const species = [];
  if (combined.includes('perro') || combined.includes('can') || combined.includes('perros')) {
    species.push('perro');
  }
  if (combined.includes('gato') || combined.includes('felino') || combined.includes('gatos')) {
    species.push('gato');
  }
  
  // Extract food-related terms
  const foodTerms = [];
  if (combined.includes('alimentación') || combined.includes('alimentacion')) {
    foodTerms.push('alimentación');
  }
  if (combined.includes('comida')) {
    foodTerms.push('comida');
  }
  if (combined.includes('pienso')) {
    foodTerms.push('pienso');
  }
  if (combined.includes('croquetas')) {
    foodTerms.push('croquetas');
  }
  if (combined.includes('dieta')) {
    foodTerms.push('dieta');
  }
  
  // Extract age-related terms
  const ageTerms = [];
  if (combined.match(/\b(cachorro|cachorros|puppy|joven)\b/)) {
    ageTerms.push('cachorro');
  }
  if (combined.match(/\b(adulto|adultos|adult)\b/) || combined.match(/\b\d+\s*años?\b/)) {
    // If age is mentioned (e.g., "4 años"), it's likely an adult
    ageTerms.push('adulto');
  }
  if (combined.match(/\b(senior|anciano|viejo|mayor)\b/)) {
    ageTerms.push('senior');
  }
  
  // Build search query prioritizing food terms + species + age
  const searchParts = [];
  if (foodTerms.length > 0) {
    searchParts.push(...foodTerms);
  }
  if (species.length > 0) {
    searchParts.push(...species);
  }
  if (ageTerms.length > 0) {
    searchParts.push(...ageTerms);
  }
  
  // If we have good terms, use them; otherwise fall back to current message
  if (searchParts.length > 0) {
    const optimizedQuery = searchParts.join(' ');
    logger.debug('Extracted search terms from conversation', { 
      original: currentMessage, 
      optimized: optimizedQuery,
      extracted: { foodTerms, species, ageTerms }
    });
    return optimizedQuery;
  }
  
  // Fallback: use current message but try to enhance it
  // If current message doesn't have food terms but conversation does, add them
  const currentLower = currentMessage.toLowerCase();
  if (!currentLower.match(/\b(alimentaci[oó]n|comida|pienso|dieta)\b/) && foodTerms.length > 0) {
    // Add food term to current message
    return `${foodTerms[0]} ${currentMessage}`;
  }
  
  return currentMessage;
}

/**
 * Get the welcome message for new sessions
 */
export function getWelcome() {
  return getWelcomeMessage();
}
