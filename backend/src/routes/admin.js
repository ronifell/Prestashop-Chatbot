import { Router } from 'express';
import { query } from '../config/database.js';
import { invalidatePatternCache } from '../services/redFlagService.js';
import { listVademecums, getVademecumPDF } from '../services/vademecumService.js';
import logger from '../utils/logger.js';

const router = Router();

// ============================================================
// FAQ MANAGEMENT
// ============================================================

/**
 * GET /api/admin/faqs
 * List all FAQs
 */
router.get('/faqs', async (_req, res) => {
  try {
    const result = await query(
      'SELECT * FROM faqs ORDER BY category, priority DESC, id'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/faqs
 * Create a new FAQ
 */
router.post('/faqs', async (req, res) => {
  try {
    const { category, question, answer, keywords, priority } = req.body;

    if (!category || !question || !answer) {
      return res.status(400).json({
        success: false,
        error: 'category, question y answer son obligatorios',
      });
    }

    const result = await query(
      `INSERT INTO faqs (category, question, answer, keywords, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [category, question, answer, keywords || [], priority || 0]
    );

    logger.info('FAQ created', { id: result.rows[0].id, category });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/faqs/:id
 * Update a FAQ
 */
router.put('/faqs/:id', async (req, res) => {
  try {
    const { category, question, answer, keywords, priority, is_active } = req.body;
    const result = await query(
      `UPDATE faqs SET
        category = COALESCE($1, category),
        question = COALESCE($2, question),
        answer = COALESCE($3, answer),
        keywords = COALESCE($4, keywords),
        priority = COALESCE($5, priority),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [category, question, answer, keywords, priority, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'FAQ no encontrada' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/faqs/:id
 */
router.delete('/faqs/:id', async (req, res) => {
  try {
    await query('DELETE FROM faqs WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'FAQ eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// SYSTEM PROMPTS MANAGEMENT
// ============================================================

/**
 * GET /api/admin/prompts
 * List all system prompts
 */
router.get('/prompts', async (_req, res) => {
  try {
    const result = await query(
      'SELECT * FROM system_prompts ORDER BY is_active DESC, version DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/prompts/:name
 * Update a system prompt (creates new version)
 */
router.put('/prompts/:name', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, error: 'content es obligatorio' });
    }

    // Update existing prompt in place (name has UNIQUE constraint)
    const result = await query(
      `UPDATE system_prompts
       SET content = $1, version = version + 1, is_active = true, updated_at = NOW()
       WHERE name = $2 RETURNING *`,
      [content, req.params.name]
    );

    if (result.rows.length === 0) {
      // Prompt doesn't exist yet — create it
      const insertResult = await query(
        `INSERT INTO system_prompts (name, content, is_active, version)
         VALUES ($1, $2, true, 1) RETURNING *`,
        [req.params.name, content]
      );
      logger.info('System prompt created', { name: req.params.name, version: 1 });
      return res.status(201).json({ success: true, data: insertResult.rows[0] });
    }

    logger.info('System prompt updated', { name: req.params.name, version: result.rows[0].version });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// RED FLAG PATTERNS MANAGEMENT
// ============================================================

/**
 * GET /api/admin/red-flags
 * List all red flag patterns
 */
router.get('/red-flags', async (_req, res) => {
  try {
    const result = await query(
      'SELECT * FROM red_flag_patterns ORDER BY category, id'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/red-flags
 * Add a new red flag pattern
 */
router.post('/red-flags', async (req, res) => {
  try {
    const { category, pattern_type, keywords, severity } = req.body;

    if (!category || !pattern_type || !keywords) {
      return res.status(400).json({
        success: false,
        error: 'category, pattern_type y keywords son obligatorios',
      });
    }

    const result = await query(
      `INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [category, pattern_type, keywords, severity || 'emergency']
    );

    invalidatePatternCache();
    logger.info('Red flag pattern added', { id: result.rows[0].id, category });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/red-flags/:id
 */
router.put('/red-flags/:id', async (req, res) => {
  try {
    const { category, pattern_type, keywords, severity, is_active } = req.body;
    const result = await query(
      `UPDATE red_flag_patterns SET
        category = COALESCE($1, category),
        pattern_type = COALESCE($2, pattern_type),
        keywords = COALESCE($3, keywords),
        severity = COALESCE($4, severity),
        is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [category, pattern_type, keywords, severity, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Patrón no encontrado' });
    }

    invalidatePatternCache();
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/red-flags/:id
 */
router.delete('/red-flags/:id', async (req, res) => {
  try {
    await query('DELETE FROM red_flag_patterns WHERE id = $1', [req.params.id]);
    invalidatePatternCache();
    res.json({ success: true, message: 'Patrón eliminado' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// VADEMECUMS MANAGEMENT
// ============================================================

/**
 * GET /api/admin/vademecums
 * List all vademecums (metadata only, excludes binary data)
 */
router.get('/vademecums', async (_req, res) => {
  try {
    const vademecums = await listVademecums();
    res.json({ success: true, data: vademecums });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/vademecums/:id/pdf
 * Download/serve a specific PDF file from the database
 */
router.get('/vademecums/:id/pdf', async (req, res) => {
  try {
    const vademecumId = parseInt(req.params.id, 10);
    if (isNaN(vademecumId)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const pdfData = await getVademecumPDF(vademecumId);
    
    if (!pdfData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Vademécum no encontrado o no tiene archivo PDF almacenado' 
      });
    }

    // Set appropriate headers for PDF download/viewing
    res.setHeader('Content-Type', pdfData.mimeType);
    res.setHeader('Content-Length', pdfData.size);
    res.setHeader('Content-Disposition', `inline; filename="${pdfData.filename || `vademecum-${vademecumId}.pdf`}"`);
    
    // Send the PDF buffer
    res.send(pdfData.buffer);
    
    logger.info('PDF served from database', { vademecumId, filename: pdfData.filename, size: pdfData.size });
  } catch (error) {
    logger.error('Error serving PDF', { error: error.message, vademecumId: req.params.id });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/vademecums/:id
 * Update vademecum metadata (activate/deactivate)
 */
router.put('/vademecums/:id', async (req, res) => {
  try {
    const { is_active, product_ids } = req.body;
    const vademecumId = parseInt(req.params.id, 10);
    
    if (isNaN(vademecumId)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const result = await query(
      `UPDATE vademecums SET
        is_active = COALESCE($1, is_active),
        product_ids = COALESCE($2, product_ids),
        updated_at = NOW()
       WHERE id = $3 RETURNING id, original_name, file_size, is_active, product_ids`,
      [is_active, product_ids, vademecumId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vademécum no encontrado' });
    }

    logger.info('Vademecum updated', { id: vademecumId });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/vademecums/:id
 * Delete a vademecum (soft delete by setting is_active = false, or hard delete)
 */
router.delete('/vademecums/:id', async (req, res) => {
  try {
    const vademecumId = parseInt(req.params.id, 10);
    if (isNaN(vademecumId)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const { hard } = req.query; // ?hard=true for permanent deletion
    
    if (hard === 'true') {
      await query('DELETE FROM vademecums WHERE id = $1', [vademecumId]);
      logger.info('Vademecum permanently deleted', { id: vademecumId });
      res.json({ success: true, message: 'Vademécum eliminado permanentemente' });
    } else {
      await query('UPDATE vademecums SET is_active = false, updated_at = NOW() WHERE id = $1', [vademecumId]);
      logger.info('Vademecum deactivated', { id: vademecumId });
      res.json({ success: true, message: 'Vademécum desactivado' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// STATS
// ============================================================

/**
 * GET /api/admin/stats
 * Get chat statistics
 */
router.get('/stats', async (_req, res) => {
  try {
    const stats = await query('SELECT * FROM chat_stats LIMIT 30');
    const totalConversations = await query('SELECT COUNT(*) FROM conversations');
    const totalMessages = await query('SELECT COUNT(*) FROM messages');
    const totalProducts = await query('SELECT COUNT(*) FROM products WHERE is_active = true');
    const totalClinics = await query('SELECT COUNT(*) FROM vet_clinics WHERE is_active = true');

    res.json({
      success: true,
      data: {
        daily: stats.rows,
        totals: {
          conversations: parseInt(totalConversations.rows[0].count, 10),
          messages: parseInt(totalMessages.rows[0].count, 10),
          products: parseInt(totalProducts.rows[0].count, 10),
          clinics: parseInt(totalClinics.rows[0].count, 10),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
