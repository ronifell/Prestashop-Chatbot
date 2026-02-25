import { v4 as uuidv4 } from 'uuid';
import { query, getClient } from '../config/database.js';
import { detectRedFlags } from './redFlagService.js';
import { getTemplate, getWelcomeMessage } from './templateService.js';
import { searchProducts, formatProductsForContext, formatProductCard } from './productService.js';
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
    const products = await searchProducts(message, { limit: 5 });
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

  // 12. Save assistant response
  const productIds = recommendedProducts.map(p => p.id);
  await saveMessage(convId, 'assistant', aiResponse.message, {
    responseType: 'normal',
    tokensUsed: aiResponse.tokensUsed,
    processingTimeMs: aiResponse.processingTimeMs,
    productsRecommended: productIds,
  });

  // 13. Update conversation
  await updateConversation(convId);

  return {
    conversationId: convId,
    message: aiResponse.message,
    responseType: 'normal',
    products: recommendedProducts,
    clinics: [],
    tokensUsed: aiResponse.tokensUsed,
    processingTimeMs: Date.now() - startTime,
  };
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
  const clinics = await findClinicsByPostalCode(postalCode);
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
 * Get the welcome message for new sessions
 */
export function getWelcome() {
  return getWelcomeMessage();
}
