import { Router } from 'express';
import { searchProducts, getProductById, getProductsByCategory, getProductCount } from '../services/productService.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/products/search?q=...&species=...&category=...&limit=...
 * Search products in the catalog
 */
router.get('/search', async (req, res) => {
  try {
    const { q, species, category, maxPrice, limit } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El parámetro de búsqueda "q" es obligatorio',
      });
    }

    const products = await searchProducts(q.trim(), {
      species,
      category,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      limit: limit ? parseInt(limit, 10) : 5,
    });

    res.json({
      success: true,
      data: products,
      count: products.length,
    });
  } catch (error) {
    logger.error('Product search endpoint error', { error: error.message });
    res.status(500).json({ success: false, error: 'Error al buscar productos' });
  }
});

/**
 * GET /api/products/:id
 * Get a single product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await getProductById(parseInt(req.params.id, 10));
    if (!product) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    logger.error('Get product error', { error: error.message });
    res.status(500).json({ success: false, error: 'Error al obtener el producto' });
  }
});

/**
 * GET /api/products/category/:category
 * Get products by category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const products = await getProductsByCategory(req.params.category);
    res.json({ success: true, data: products, count: products.length });
  } catch (error) {
    logger.error('Get products by category error', { error: error.message });
    res.status(500).json({ success: false, error: 'Error al obtener productos por categoría' });
  }
});

/**
 * GET /api/products/stats/count
 * Get total product count
 */
router.get('/stats/count', async (_req, res) => {
  try {
    const count = await getProductCount();
    res.json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al contar productos' });
  }
});

export default router;
