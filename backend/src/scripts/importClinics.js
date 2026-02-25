/**
 * CLI Script: Import Veterinary Clinics from Excel
 * Usage: node src/scripts/importClinics.js <path-to-file>
 * 
 * Actual Excel structure from MundoMascotix:
 *   Código postal | Ciudad | Tipo | Nombre | Dirección | Horario | Teléfono
 * 
 * Safe to re-run: clears existing clinics and imports fresh.
 */
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

import { query, getClient } from '../config/database.js';

/**
 * Map a raw Excel row to a clinic object.
 */
function mapRow(row) {
  const tipo = String(row.Tipo || row.tipo || row.type || '').trim().toLowerCase();

  // Detect emergency/hospital by "Tipo" column
  const isEmergency =
    tipo.includes('hospital') ||
    tipo.includes('urgencia') ||
    tipo.includes('24 horas') ||
    tipo.includes('24h');

  // Extract province from "Ciudad" if it contains " - Province"
  const ciudadRaw = String(row.Ciudad || row.ciudad || row.city || '').trim();
  let city = ciudadRaw;
  let province = '';
  if (ciudadRaw.includes(' - ')) {
    const parts = ciudadRaw.split(' - ');
    city = parts[0].trim();
    province = parts[1].trim();
  }

  // Build notes from Tipo + Horario
  const horario = String(row.Horario || row.horario || '').trim();
  const tipoOriginal = String(row.Tipo || row.tipo || '').trim();
  const notes = [tipoOriginal, horario ? `Horario: ${horario}` : ''].filter(Boolean).join(' | ');

  return {
    postalCode: String(row['Código postal'] || row['Codigo postal'] || row.postal_code || row.codigo_postal || row.CP || '').trim(),
    city,
    province,
    name: String(row.Nombre || row.nombre || row.name || '').trim(),
    address: String(row['Dirección'] || row.Direccion || row.direccion || row.address || '').trim(),
    phone: String(row['Teléfono'] || row.Telefono || row.telefono || row.phone || '').trim(),
    email: String(row.email || row.Email || row.correo || '').trim(),
    website: String(row.website || row.web || row.Web || '').trim(),
    isEmergency,
    notes,
  };
}

async function importClinics(filePath) {
  const resolvedPath = resolve(filePath);
  console.log(`📂 Reading file: ${resolvedPath}`);

  const workbook = XLSX.readFile(resolvedPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`📊 Found ${rows.length} rows`);

  if (rows.length > 0) {
    console.log(`📋 Detected columns: ${Object.keys(rows[0]).join(' | ')}`);
  }

  const client = await getClient();

  try {
    // Clear existing clinics for fresh import
    const existing = await client.query('SELECT COUNT(*) AS cnt FROM vet_clinics');
    const existingCount = parseInt(existing.rows[0].cnt, 10);
    if (existingCount > 0) {
      console.log(`🗑️  Clearing ${existingCount} existing clinics...`);
      await client.query('DELETE FROM vet_clinics');
    }

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const clinic = mapRow(row);

      if (!clinic.name || !clinic.postalCode) {
        console.warn(`  ⚠️ Skipping: missing name or postal code (row: ${JSON.stringify(row).substring(0, 80)})`);
        skipped++;
        continue;
      }

      try {
        await client.query(
          `INSERT INTO vet_clinics (name, address, city, province, postal_code, phone, email, website, is_emergency, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            clinic.name,
            clinic.address,
            clinic.city,
            clinic.province,
            clinic.postalCode.padStart(5, '0'),
            clinic.phone,
            clinic.email,
            clinic.website,
            clinic.isEmergency,
            clinic.notes,
          ]
        );
        imported++;
        const emergencyTag = clinic.isEmergency ? ' 🚨 (24h)' : '';
        console.log(`  ✅ ${clinic.name} — ${clinic.postalCode} ${clinic.city}${emergencyTag}`);
      } catch (error) {
        console.error(`  ❌ Error: ${clinic.name}: ${error.message}`);
        skipped++;
      }
    }

    console.log(`\n✅ Import complete:`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log(`   Total:    ${rows.length}`);
  } finally {
    client.release();
  }

  process.exit(0);
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node src/scripts/importClinics.js <path-to-excel-file>');
  process.exit(1);
}

importClinics(filePath);
