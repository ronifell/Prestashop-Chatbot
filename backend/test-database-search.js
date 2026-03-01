/**
 * Test database product search directly
 * Checks what products exist and tests search queries
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { query } from './src/config/database.js';
import { searchProductsByCategories, searchProductsWithIntent } from './src/services/productService.js';
import { detectIntent } from './src/services/intentService.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testDatabase() {
  log('\n🔍 Testing Database Product Search', 'cyan');
  log('='.repeat(70), 'cyan');

  try {
    // 1. Check total products
    log('\n📊 Database Statistics', 'yellow');
    const countResult = await query('SELECT COUNT(*) as total FROM products WHERE is_active = true');
    const totalProducts = parseInt(countResult.rows[0].total, 10);
    log(`   Total active products: ${totalProducts}`, totalProducts > 0 ? 'green' : 'yellow');

    if (totalProducts === 0) {
      log('   ⚠️  No products found in database!', 'yellow');
      return;
    }

    // 2. Check unique categories
    const categoriesResult = await query(`
      SELECT DISTINCT category, COUNT(*) as count 
      FROM products 
      WHERE is_active = true AND category IS NOT NULL 
      GROUP BY category 
      ORDER BY count DESC 
      LIMIT 20
    `);
    
    log(`\n   Categories found (top 20):`, 'blue');
    categoriesResult.rows.forEach((row, i) => {
      log(`   ${i + 1}. ${row.category} (${row.count} products)`, 'cyan');
    });

    // 3. Test specific category searches
    log('\n🔎 Testing Category Searches', 'yellow');
    
    const testCategories = [
      'CONDROPROTECTOR/ARTICULAR',
      'CONDROPROTECTOR',
      'ARTICULAR',
      'RENAL',
      'DIETA VETERINARIA',
      'GASTROINTESTINAL',
      'BUCODENTAL',
      'ÓTICO',
      'ANTIPARASITARIOS',
    ];

    for (const catName of testCategories) {
      const products = await searchProductsByCategories([catName], { limit: 5 });
      if (products.length > 0) {
        log(`   ✅ "${catName}": Found ${products.length} products`, 'green');
        products.slice(0, 2).forEach(p => {
          log(`      - ${p.name} (${p.category})`, 'cyan');
        });
      } else {
        log(`   ❌ "${catName}": No products found`, 'red');
      }
    }

    // 4. Test intent-based search
    log('\n🎯 Testing Intent-Based Search', 'yellow');
    
    const testMessages = [
      'condroprotector',
      'renal',
      'probióticos',
      'antiparasitario',
    ];

    for (const message of testMessages) {
      const intentData = detectIntent(message);
      log(`\n   Message: "${message}"`, 'blue');
      log(`   Intent: ${intentData.intent || 'none'}`, intentData.intent ? 'green' : 'yellow');
      
      if (intentData.intent) {
        const products = await searchProductsWithIntent(message, intentData, { limit: 5 });
        if (products.length > 0) {
          log(`   ✅ Found ${products.length} products:`, 'green');
          products.forEach((p, i) => {
            log(`      ${i + 1}. ${p.name}`, 'cyan');
            log(`         Category: ${p.category}${p.subcategory ? ' / ' + p.subcategory : ''}`, 'cyan');
          });
        } else {
          log(`   ⚠️  No products found for intent`, 'yellow');
          log(`      Category candidates: ${JSON.stringify(intentData.categoryCandidates)}`, 'yellow');
        }
      }
    }

    // 5. Test subcategory search
    log('\n📂 Testing Subcategory Search', 'yellow');
    const subcategoriesResult = await query(`
      SELECT DISTINCT subcategory, COUNT(*) as count 
      FROM products 
      WHERE is_active = true AND subcategory IS NOT NULL 
      GROUP BY subcategory 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    log(`   Top subcategories:`, 'blue');
    subcategoriesResult.rows.forEach((row, i) => {
      log(`   ${i + 1}. ${row.subcategory} (${row.count} products)`, 'cyan');
    });

    // 6. Search for specific products mentioned in Fix.md
    log('\n🔍 Searching for Specific Products from Fix.md', 'yellow');
    const specificSearches = [
      { term: 'condrovet', category: 'CONDROPROTECTOR' },
      { term: 'seraquin', category: 'CONDROPROTECTOR' },
      { term: 'fortiflora', category: 'GASTROINTESTINAL' },
      { term: 'renal', category: 'DIETA VETERINARIA' },
    ];

    for (const search of specificSearches) {
      const result = await query(`
        SELECT name, category, subcategory 
        FROM products 
        WHERE is_active = true 
          AND (LOWER(name) LIKE $1 OR LOWER(category) LIKE $1 OR LOWER(subcategory) LIKE $1)
        LIMIT 5
      `, [`%${search.term}%`]);
      
      if (result.rows.length > 0) {
        log(`   ✅ "${search.term}": Found ${result.rows.length} products`, 'green');
        result.rows.forEach(p => {
          log(`      - ${p.name}`, 'cyan');
        });
      } else {
        log(`   ❌ "${search.term}": No products found`, 'red');
      }
    }

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  }
}

testDatabase().then(() => {
  log('\n✅ Database search test completed', 'green');
  process.exit(0);
}).catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
