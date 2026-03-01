/**
 * Test direct subcategory search
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { query } from './src/config/database.js';

async function testSubcategory() {
  console.log('\n🔍 Testing CONDROPROTECTOR/ARTICULAR subcategory directly\n');
  
  // Test 1: Exact subcategory match
  const result1 = await query(`
    SELECT name, category, subcategory 
    FROM products 
    WHERE is_active = true 
      AND subcategory ILIKE '%CONDROPROTECTOR%'
    LIMIT 10
  `);
  
  console.log(`Found ${result1.rows.length} products with CONDROPROTECTOR in subcategory:`);
  result1.rows.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   Category: ${p.category}, Subcategory: ${p.subcategory}\n`);
  });
  
  // Test 2: ARTICULAR in subcategory
  const result2 = await query(`
    SELECT name, category, subcategory 
    FROM products 
    WHERE is_active = true 
      AND subcategory ILIKE '%ARTICULAR%'
    LIMIT 10
  `);
  
  console.log(`\nFound ${result2.rows.length} products with ARTICULAR in subcategory:`);
  result2.rows.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   Category: ${p.category}, Subcategory: ${p.subcategory}\n`);
  });
  
  // Test 3: Products with "condro" in name
  const result3 = await query(`
    SELECT name, category, subcategory 
    FROM products 
    WHERE is_active = true 
      AND LOWER(name) LIKE '%condro%'
    LIMIT 10
  `);
  
  console.log(`\nFound ${result3.rows.length} products with "condro" in name:`);
  result3.rows.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
    console.log(`   Category: ${p.category}, Subcategory: ${p.subcategory}\n`);
  });
}

testSubcategory().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
