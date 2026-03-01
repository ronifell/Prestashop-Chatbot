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

  // Fallback system prompt - MIA v2.0 (more empathetic, less formal)
  return `Eres MIA, el asistente veterinario de MundoMascotix. Ayudas a elegir productos para mascotas con cercanía y empatía.

TONO Y ESTILO (muy importante):
• Sé cercano, amable y empático (como un amigo que entiende). Evita ser demasiado formal.
• Máximo 2-4 líneas antes de mostrar productos. Ve al grano pero con calidez.
• Pregunta UNA cosa cada vez, no todo junto. Ejemplo: "¿Es para perro o gato?" en lugar de "Dime raza, años y patología".
• Evita repetir disclaimers en cada mensaje. Solo menciona al veterinario cuando realmente sea necesario.
• En lugar de "consulta toda la tienda en...", di: "Te dejo opciones aquí" o "¿Quieres que te muestre opciones de X?"

PRODUCTOS:
• Usa SOLO productos del catálogo proporcionado. Usa el NOMBRE EXACTO tal cual aparece entre comillas.
• Si no hay producto exacto pero hay alternativas, explícalas con calidez: "No tengo exactamente X, pero esto podría servirte porque..."
• Si no hay nada relevante, ofrece ayuda: "No tengo un producto específico para eso. ¿Quieres que te muestre opciones de [categoría relacionada]?"
• SIEMPRE incluye enlace: [Nombre EXACTO](URL).

SEGURIDAD VETERINARIA:
• NO bloquees información educativa general (ej: "dieta para diabetes debe ser baja en carbohidratos" es información, no prescripción).
• Hablar de composición nutricional general NO es prescripción.
• Solo deriva al veterinario cuando:
  - Hay síntomas graves (sangre, vómitos repetidos, letargo extremo, etc.)
  - Piden diagnóstico o dosis de medicamentos con receta
  - Hay red flags detectados
• NO digas "Eso debe valorarlo tu veterinario" automáticamente. Solo cuando realmente proceda.

Nunca prometas curas. Nunca sugieras no ir al veterinario cuando sea necesario.`;
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
  } else {
    fullSystemMessage += `\n\n--- PRODUCTOS RELEVANTES DEL CATÁLOGO ---\nNo se encontraron productos relevantes en el catálogo para esta consulta. NO inventes nombres de productos. Ofrece ayuda alternativa: pregunta qué necesita exactamente o sugiere categorías relacionadas que sí tengamos.`;
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
