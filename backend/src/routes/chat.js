import { Router } from 'express';
import { processMessage, getWelcome } from '../services/chatService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/chat
 * Main chat endpoint - receives user message, returns AI response
 */
router.post('/', async (req, res) => {
  try {
    const { sessionId, message, conversationId, productContext } = req.body;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sessionId es obligatorio',
      });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El mensaje no puede estar vacío',
      });
    }

    // Limit message length
    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'El mensaje es demasiado largo (máximo 2000 caracteres)',
      });
    }

    // Process the message through the full pipeline
    const response = await processMessage({
      sessionId,
      message: message.trim(),
      conversationId: conversationId || null,
      productContext: productContext || null,
    });

    // Log the chat interaction
    logger.info('Chat message processed', {
      sessionId,
      conversationId: response.conversationId,
      responseType: response.responseType,
      processingTimeMs: response.processingTimeMs,
      productsRecommended: response.products?.length || 0,
    });

    return res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Chat endpoint error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      error: 'Error al procesar tu mensaje. Por favor, inténtalo de nuevo.',
    });
  }
});

/**
 * GET /api/chat/welcome
 * Returns the welcome message and disclaimer
 */
router.get('/welcome', (_req, res) => {
  const welcome = getWelcome();
  res.json({
    success: true,
    data: welcome,
  });
});

/**
 * GET /api/chat/health
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'MIA Chatbot API',
    timestamp: new Date().toISOString(),
  });
});

export default router;
