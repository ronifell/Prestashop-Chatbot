/**
 * CLI Script: Import Products from Excel/CSV
 * Usage: node src/scripts/importProducts.js <path-to-file>
 * 
 * Optimized for large catalogs (2000+ rows) using batch UPSERT.
 * Safe to re-run: existing products are updated, new ones are inserted.
 */
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

import { query, getClient } from '../config/database.js';

const BATCH_SIZE = 50;

/**
 * Map a raw Excel row to a product object.
 * 
 * Actual Excel structure from MundoMascotix:
 *   SKU | Nombre | Importe | Categoría | Categoría (2nd=subcategory) | Marca | Código de barras
 * 
 * Note: xlsx renames duplicate headers → 2nd "Categoría" becomes "Categoría_1"
 */
function mapRow(row) {
  const subcategory =
    row['Categoría_1'] || row['Categoria_1'] ||
    row.subcategory || row.subcategoria || row.Subcategoría || '';

  const rawBarcode = String(row['Código de barras'] || row['Codigo de barras'] || row.barcode || row.EAN || '').trim();

  return {
    code: String(row.SKU || row.sku || row.code || row.codigo || row.Código || row.Code || '').trim(),
    name: String(row.Nombre || row.nombre || row.name || row.Name || '').trim(),
    brand: String(row.Marca || row.marca || row.brand || row.Brand || '').trim(),
    category: String(row['Categoría'] || row.Categoria || row.category || row.categoria || row.Category || '').trim(),
    subcategory: String(subcategory).trim(),
    species: String(row.species || row.especie || row.Especie || row.Species || '').trim(),
    price: parseFloat(row.Importe || row.importe || row.price || row.precio || row.Precio || 0) || null,
    barcode: rawBarcode || null,  // null if empty (avoids UNIQUE constraint issues)
    productUrl: String(row.product_url || row.url || row.URL || row.enlace || '').trim(),
    addToCartUrl: String(row.add_to_cart_url || row.carrito || row.cart_url || '').trim(),
    imageUrl: String(row.image_url || row.imagen || row.Imagen || '').trim(),
    description: String(row.description || row.descripcion || row.Descripción || '').trim(),
    indications: String(row.indications || row.indicaciones || row.Indicaciones || '').trim(),
    activeIngredients: String(row.active_ingredients || row.principio_activo || row.ingredientes || '').trim(),
    requiresPrescription: Boolean(row.requires_prescription || row.receta || row.Receta),
  };
}

/**
 * Build a batch UPSERT query for N products.
 * Uses ON CONFLICT (prestashop_id) DO UPDATE so re-imports update existing data.
 * Products without a barcode are always inserted (NULL doesn't trigger UNIQUE).
 */
function buildBatchUpsert(products) {
  const COLS = 15;
  const columns = `prestashop_id, code, name, brand, category, subcategory, species, price,
    product_url, add_to_cart_url, image_url, description, indications,
    active_ingredients, requires_prescription`;

  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const p of products) {
    const placeholders = Array.from({ length: COLS }, (_, i) => `$${paramIdx + i}`).join(',');
    values.push(`(${placeholders})`);
    params.push(
      p.barcode, p.code, p.name, p.brand, p.category, p.subcategory,
      p.species, p.price, p.productUrl, p.addToCartUrl, p.imageUrl,
      p.description, p.indications, p.activeIngredients, p.requiresPrescription
    );
    paramIdx += COLS;
  }

  const sql = `
    INSERT INTO products (${columns})
    VALUES ${values.join(',\n')}
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
      updated_at = NOW()`;

  return { sql, params };
}

/**
 * Single-row UPSERT (used as fallback when a batch fails)
 */
const SINGLE_UPSERT_SQL = `
  INSERT INTO products (prestashop_id, code, name, brand, category, subcategory, species, price,
    product_url, add_to_cart_url, image_url, description, indications,
    active_ingredients, requires_prescription)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
    updated_at = NOW()`;

async function importProducts(filePath) {
  const resolvedPath = resolve(filePath);
  console.log(`📂 Reading file: ${resolvedPath}`);

  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`📊 Found ${rows.length} rows`);

  // Show detected column names
  if (rows.length > 0) {
    console.log(`📋 Detected columns: ${Object.keys(rows[0]).join(' | ')}`);
  }

  // Map and filter rows
  const products = [];
  let skipped = 0;

  for (const row of rows) {
    const mapped = mapRow(row);
    if (!mapped.name) {
      skipped++;
      continue;
    }
    products.push(mapped);
  }

  console.log(`✅ Valid products: ${products.length} | ⚠️ Skipped (no name): ${skipped}`);

  // Get a dedicated client for the import
  const client = await getClient();

  let imported = 0;
  let updated = 0;
  let errors = 0;
  const totalBatches = Math.ceil(products.length / BATCH_SIZE);

  try {
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      try {
        const { sql, params } = buildBatchUpsert(batch);
        await client.query(sql, params);
        imported += batch.length;
        process.stdout.write(`\r  Batch ${batchNum}/${totalBatches} — ${imported}/${products.length} processed`);
      } catch (batchError) {
        // Batch failed — fall back to row-by-row with individual error handling
        console.log(`\n  ⚠️ Batch ${batchNum} failed (${batchError.message}), trying row-by-row...`);
        for (const p of batch) {
          try {
            await client.query(SINGLE_UPSERT_SQL, [
              p.barcode, p.code, p.name, p.brand, p.category, p.subcategory,
              p.species, p.price, p.productUrl, p.addToCartUrl, p.imageUrl,
              p.description, p.indications, p.activeIngredients, p.requiresPrescription,
            ]);
            imported++;
          } catch (rowError) {
            console.error(`\n  ❌ Error: "${p.name}" (SKU: ${p.code}): ${rowError.message}`);
            errors++;
          }
        }
      }
    }

    console.log(''); // newline after progress bar
  } finally {
    client.release();
  }

  console.log(`\n✅ Import complete:`);
  console.log(`   Processed: ${imported}`);
  console.log(`   Skipped:   ${skipped}`);
  console.log(`   Errors:    ${errors}`);
  console.log(`   Total:     ${rows.length}`);
  process.exit(0);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node src/scripts/importProducts.js <path-to-excel-file>');
  process.exit(1);
}

importProducts(filePath);
