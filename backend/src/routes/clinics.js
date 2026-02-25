import { Router } from 'express';
import { findClinicsByPostalCode, getClinicCount } from '../services/clinicService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/clinics/:postalCode
 * Find veterinary clinics by postal code
 */
router.get('/:postalCode', async (req, res) => {
  try {
    const { postalCode } = req.params;

    // Validate postal code format
    if (!/^\d{5}$/.test(postalCode)) {
      return res.status(400).json({
        success: false,
        error: 'El código postal debe tener 5 dígitos',
      });
    }

    const clinics = await findClinicsByPostalCode(postalCode);
    res.json({
      success: true,
      data: clinics,
      count: clinics.length,
    });
  } catch (error) {
    logger.error('Clinic lookup error', { error: error.message });
    res.status(500).json({ success: false, error: 'Error al buscar clínicas' });
  }
});

/**
 * GET /api/clinics/stats/count
 * Get total clinic count
 */
router.get('/stats/count', async (_req, res) => {
  try {
    const count = await getClinicCount();
    res.json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al contar clínicas' });
  }
});

export default router;
