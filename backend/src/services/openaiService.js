import openai from '../config/openai.js';
import config from '../config/index.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * OpenAI Service
 * Handles all communication with the OpenAI API.
 */

/**
 * Get the active system prompt from the database
 * @returns {string}
 */
async function getSystemPrompt() {
  try {
    const result = await query(
      "SELECT content FROM system_prompts WHERE name = 'main_assistant' AND is_active = true ORDER BY version DESC LIMIT 1"
    );
    if (result.rows.length > 0) {
      return result.rows[0].content;
    }
  } catch (error) {
    logger.warn('Could not load system prompt from DB, using default');
  }

  // Fallback system prompt
  return `Eres MIA, el asistente veterinario de la tienda online MundoMascotix en España. Orientas sobre productos, NO diagnosticas ni prescribes.
Sé MUY BREVE y DIRECTO (máximo 3-4 líneas). Ve al grano, sin introducciones largas.
Cuando necesites datos, pregunta todo junto: "Dime raza, años y si tiene alguna patología."

PRODUCTOS — REGLA CRÍTICA:
• Usa SOLO productos del catálogo proporcionado en "PRODUCTOS RELEVANTES DEL CATÁLOGO".
• Usa el NOMBRE EXACTO del producto tal cual aparece entre comillas en el catálogo, sin resumirlo, abreviarlo ni modificarlo.
• NUNCA inventes marcas ni productos que no estén en el catálogo (no menciones Royal Canin, Advance, Hill's, Purina ni otras marcas que no figuren en el listado).
• Si no existe un producto exacto para lo que busca el cliente, recomienda el producto MÁS SIMILAR que SÍ exista en el catálogo y explica por qué podría servirle.
• Si no hay NINGÚN producto relevante en el catálogo, di: "No tengo un producto específico en nuestro catálogo para eso. Puedes consultar toda nuestra tienda en mundomascotix.com."
• SIEMPRE incluye el enlace al producto: [Nombre EXACTO del producto](URL_del_producto).

Si piden diagnóstico o dosis de receta: "Eso debe valorarlo tu veterinario/a."
SOLO añade aviso veterinario si el usuario menciona SÍNTOMAS. Si solo pregunta por alimentación o productos, NO añadas "si los síntomas persisten…" porque NO aplica.
Nunca prometas curas. Nunca sugieras no ir al veterinario.`;
}

/**
 * Generate a chat completion with conversation context
 * @param {Array} conversationHistory - Array of { role, content } messages
 * @param {string} productContext - Optional: current product page info
 * @param {string} catalogContext - Optional: relevant products found via search
 * @param {string} vademecumContext - Optional: relevant vademecum info
 * @returns {Object} - { message, tokensUsed }
 */
export async function generateChatResponse(
  conversationHistory,
  productContext = '',
  catalogContext = '',
  vademecumContext = ''
) {
  const systemPrompt = await getSystemPrompt();

  // Build the full system message with context
  let fullSystemMessage = systemPrompt;

  if (productContext) {
    fullSystemMessage += `\n\n--- CONTEXTO DEL PRODUCTO ACTUAL ---\nEl usuario está viendo esta página de producto:\n${productContext}`;
  }

  if (catalogContext) {
    fullSystemMessage += `\n\n--- PRODUCTOS RELEVANTES DEL CATÁLOGO ---\n(SOLO puedes recomendar productos de esta lista. Usa el NOMBRE EXACTO entre comillas. Si ninguno encaja perfectamente, recomienda el más parecido de esta lista.)\n\n${catalogContext}`;
  } else {
    fullSystemMessage += `\n\n--- PRODUCTOS RELEVANTES DEL CATÁLOGO ---\nNo se encontraron productos relevantes en el catálogo para esta consulta. NO inventes nombres de productos. Indica al usuario: "No tengo un producto específico en nuestro catálogo para eso. Puedes consultar toda nuestra tienda en mundomascotix.com."`;
  }

  if (vademecumContext) {
    fullSystemMessage += `\n\n--- INFORMACIÓN TÉCNICA (VADEMECUM) ---\n${vademecumContext}`;
  }

  const messages = [
    { role: 'system', content: fullSystemMessage },
    ...conversationHistory.slice(-10), // Keep last 10 messages for context
  ];

  try {
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages,
      max_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    });

    const processingTime = Date.now() - startTime;
    const response = completion.choices[0]?.message?.content || '';
    const tokensUsed = completion.usage?.total_tokens || 0;

    logger.info('OpenAI response generated', {
      model: config.openai.model,
      tokensUsed,
      processingTimeMs: processingTime,
    });

    return {
      message: response,
      tokensUsed,
      processingTimeMs: processingTime,
    };
  } catch (error) {
    logger.error('OpenAI API error', { error: error.message, status: error.status });

    if (error.status === 429) {
      return {
        message: 'Disculpa, estamos recibiendo muchas consultas en este momento. Por favor, inténtalo de nuevo en unos segundos.',
        tokensUsed: 0,
        processingTimeMs: 0,
        error: 'rate_limit',
      };
    }

    return {
      message: 'Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, inténtalo de nuevo.',
      tokensUsed: 0,
      processingTimeMs: 0,
      error: error.message,
    };
  }
}
