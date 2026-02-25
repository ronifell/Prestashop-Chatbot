/**
 * CLI Script: Import Vademecum PDFs from a directory
 * Usage: node src/scripts/importVademecums.js <path-to-directory>
 */
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, extname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

import { storeVademecum } from '../services/vademecumService.js';

async function importVademecums(dirPath) {
  const resolvedPath = resolve(dirPath);
  console.log(`📂 Scanning directory: ${resolvedPath}`);

  const files = readdirSync(resolvedPath).filter(
    (f) => extname(f).toLowerCase() === '.pdf'
  );

  console.log(`📄 Found ${files.length} PDF files`);

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  for (const file of files) {
    const filePath = join(resolvedPath, file);
    console.log(`  Processing: ${file}...`);

    try {
      const result = await storeVademecum(filePath, file);
      if (result.duplicate) {
        console.log(`  ⏭️ Duplicate, skipped`);
        duplicates++;
      } else {
        console.log(`  ✅ Imported (${result.chunksCount} chunks)`);
        imported++;
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n✅ Import complete:`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Duplicates: ${duplicates}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${files.length}`);
  process.exit(0);
}

const dirPath = process.argv[2];
if (!dirPath) {
  console.error('Usage: node src/scripts/importVademecums.js <path-to-pdf-directory>');
  process.exit(1);
}

importVademecums(dirPath);
