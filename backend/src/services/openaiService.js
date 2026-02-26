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
  return `Eres MIA, el asistente veterinario de la tienda online MundoMascotix en España.
Tu rol es el de un asistente farmacéutico veterinario que orienta sobre productos, pero NO diagnosticas ni prescribes.
Escribe en español de España, con tono amable pero profesional.
Recomienda EXCLUSIVAMENTE productos del catálogo de la tienda. No inventes marcas ni productos que no estén en el catálogo.
Usa el nombre EXACTO del producto tal como aparece en el catálogo, sin resumirlo, sin cambiarlo y sin abreviarlo.
Sé breve y directo (máximo 3-4 líneas). Antes de recomendar, pregunta raza, edad y si tiene alguna patología.
Solo menciona síntomas o derivación al veterinario si el usuario ha hablado de síntomas.`;
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
    fullSystemMessage += `\n\n--- PRODUCTOS RELEVANTES DEL CATÁLOGO ---\n${catalogContext}`;
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
