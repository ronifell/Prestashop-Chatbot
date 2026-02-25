import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile } from 'fs/promises';
import XLSX from 'xlsx';
import { query } from '../config/database.js';
import { storeVademecum } from '../services/vademecumService.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, join(__dirname, '../../data/imports'));
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/pdf',
    ];
    if (allowedTypes.includes(file.mimetype) ||
        file.originalname.match(/\.(xlsx|xls|csv|pdf)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado. Usa .xlsx, .xls, .csv o .pdf'));
    }
  },
});

/**
 * POST /api/import/products
 * Import products from Excel/CSV file
 * Expected columns: code, name, brand, category, subcategory, species, price, product_url, add_to_cart_url, image_url, description, indications, active_ingredients, requires_prescription
 */
router.post('/products', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se ha proporcionado ningún archivo' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'El archivo está vacío' });
    }

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        // Map Excel columns to database fields (flexible column naming)
        // Actual MundoMascotix columns: SKU | Nombre | Importe | Categoría | Categoría(2nd) | Marca | Código de barras
        const subcategory =
          row['Categoría_1'] || row['Categoria_1'] ||
          row.subcategory || row.subcategoria || row.Subcategoría || '';

        const product = {
          barcode: String(row['Código de barras'] || row['Codigo de barras'] || row.barcode || row.EAN || ''),
          code: row.SKU || row.sku || row.code || row.codigo || row.Código || row.Code || '',
          name: row.Nombre || row.nombre || row.name || row.Name || '',
          brand: row.Marca || row.marca || row.brand || row.Brand || '',
          category: row['Categoría'] || row.Categoria || row.category || row.categoria || row.Category || '',
          subcategory,
          species: row.species || row.especie || row.Especie || row.Species || '',
          price: parseFloat(row.Importe || row.importe || row.price || row.precio || row.Precio || 0) || null,
          productUrl: row.product_url || row.url || row.URL || row.enlace || '',
          addToCartUrl: row.add_to_cart_url || row.carrito || row.cart_url || '',
          imageUrl: row.image_url || row.imagen || row.Imagen || '',
          description: row.description || row.descripcion || row.Descripción || '',
          indications: row.indications || row.indicaciones || row.Indicaciones || '',
          activeIngredients: row.active_ingredients || row.principio_activo || row.ingredientes || '',
          requiresPrescription: Boolean(row.requires_prescription || row.receta || row.Receta),
        };

        if (!product.name) {
          errors++;
          continue;
        }

        // Upsert by barcode (prestashop_id); insert if no barcode
        const upsertResult = await query(
          `INSERT INTO products (prestashop_id, code, name, brand, category, subcategory, species, price,
            product_url, add_to_cart_url, image_url, description, indications,
            active_ingredients, requires_prescription)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (prestashop_id) DO UPDATE SET
             code = EXCLUDED.code,
             name = EXCLUDED.name,
             brand = EXCLUDED.brand,
             category = EXCLUDED.category,
             subcategory = EXCLUDED.subcategory,
             species = EXCLUDED.species,
             price = EXCLUDED.price,
             product_url = EXCLUDED.product_url,
             add_to_cart_url = EXCLUDED.add_to_cart_url,
             image_url = EXCLUDED.image_url,
             description = EXCLUDED.description,
             indications = EXCLUDED.indications,
             active_ingredients = EXCLUDED.active_ingredients,
             requires_prescription = EXCLUDED.requires_prescription,
             is_active = true,
             updated_at = NOW()`,
          [
            product.barcode || null, product.code, product.name, product.brand,
            product.category, product.subcategory, product.species, product.price,
            product.productUrl, product.addToCartUrl, product.imageUrl,
            product.description, product.indications, product.activeIngredients,
            product.requiresPrescription,
          ]
        );

        imported++;
      } catch (rowError) {
        logger.warn('Product import row error', { error: rowError.message, row: row.name || 'unknown' });
        errors++;
      }
    }

    logger.info('Products import complete', { imported, updated, errors, total: rows.length });
    res.json({
      success: true,
      data: {
        total: rows.length,
        imported,
        updated,
        errors,
      },
    });
  } catch (error) {
    logger.error('Products import error', { error: error.message });
    res.status(500).json({ success: false, error: 'Error al importar productos: ' + error.message });
  }
});

/**
 * POST /api/import/clinics
 * Import veterinary clinics from Excel file
 * Expected columns: name, address, city, province, postal_code, phone, email, website, is_emergency, notes
 */
router.post('/clinics', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se ha proporcionado ningún archivo' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let imported = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const clinic = {
          name: row.name || row.nombre || row.Nombre || row.Name || '',
          address: row.address || row.direccion || row.Dirección || '',
          city: row.city || row.ciudad || row.Ciudad || '',
          province: row.province || row.provincia || row.Provincia || '',
          postalCode: String(row.postal_code || row.codigo_postal || row.CP || row['Código Postal'] || ''),
          phone: String(row.phone || row.telefono || row.Teléfono || ''),
          email: row.email || row.Email || row.correo || '',
          website: row.website || row.web || row.Web || '',
          isEmergency: Boolean(row.is_emergency || row.urgencias || row.Urgencias),
          notes: row.notes || row.notas || row.Notas || '',
        };

        if (!clinic.name || !clinic.postalCode) {
          errors++;
          continue;
        }

        await query(
          `INSERT INTO vet_clinics (name, address, city, province, postal_code, phone, email, website, is_emergency, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            clinic.name, clinic.address, clinic.city, clinic.province,
            clinic.postalCode.padStart(5, '0'), clinic.phone, clinic.email,
            clinic.website, clinic.isEmergency, clinic.notes,
          ]
        );
        imported++;
      } catch (rowError) {
        logger.warn('Clinic import row error', { error: rowError.message });
        errors++;
      }
    }

    logger.info('Clinics import complete', { imported, errors, total: rows.length });
    res.json({
      success: true,
      data: { total: rows.length, imported, errors },
    });
  } catch (error) {
    logger.error('Clinics import error', { error: error.message });
    res.status(500).json({ success: false, error: 'Error al importar clínicas: ' + error.message });
  }
});

/**
 * POST /api/import/vademecums
 * Import vademecum PDFs (supports multiple files)
 */
router.post('/vademecums', upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No se han proporcionado archivos PDF' });
    }

    const results = [];
    for (const file of req.files) {
      try {
        const result = await storeVademecum(file.path, file.originalname);
        results.push({
          filename: file.originalname,
          ...result,
        });
      } catch (fileError) {
        results.push({
          filename: file.originalname,
          error: fileError.message,
        });
      }
    }

    logger.info('Vademecums import complete', {
      total: req.files.length,
      success: results.filter(r => !r.error).length,
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Vademecums import error', { error: error.message });
    res.status(500).json({ success: false, error: 'Error al importar vademécums: ' + error.message });
  }
});

export default router;
