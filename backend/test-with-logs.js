/**
 * Test with detailed logging to see what's happening
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { searchProductsWithIntent } from './src/services/productService.js';
import { detectIntent, getNormalizedCategoryNames } from './src/services/intentService.js';

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

async function testWithLogs() {
  log('\n🔍 Testing Product Search with Detailed Logs', 'cyan');
  log('='.repeat(70), 'cyan');

  const testMessage = '¿Tienes condroprotector?';
  
  log(`\n📝 Test Message: "${testMessage}"`, 'yellow');
  
  // Step 1: Detect intent
  const intentData = detectIntent(testMessage);
  log(`\n1️⃣ Intent Detection:`, 'cyan');
  log(`   Intent: ${intentData.intent}`, intentData.intent ? 'green' : 'red');
  log(`   Category Candidates: ${JSON.stringify(intentData.categoryCandidates)}`, 'blue');
  log(`   Search Strategy: ${JSON.stringify(intentData.searchStrategy)}`, 'blue');
  log(`   Name Synonyms: ${JSON.stringify(intentData.nameSynonyms)}`, 'blue');

  if (!intentData.intent) {
    log('   ❌ No intent detected!', 'red');
    return;
  }

  // Step 2: Get normalized categories
  const normalizedCategories = getNormalizedCategoryNames(intentData.categoryCandidates);
  log(`\n2️⃣ Normalized Categories:`, 'cyan');
  log(`   ${JSON.stringify(normalizedCategories)}`, 'blue');

  // Step 3: Search by categories
  log(`\n3️⃣ Searching by Categories:`, 'cyan');
  const categoryProducts = await searchProductsWithIntent(testMessage, intentData, { limit: 5 });
  log(`   Found: ${categoryProducts.length} products`, categoryProducts.length > 0 ? 'green' : 'red');
  
  if (categoryProducts.length > 0) {
    categoryProducts.forEach((p, i) => {
      log(`   ${i + 1}. ${p.name}`, 'green');
      log(`      Category: ${p.category || 'N/A'}`, 'cyan');
      log(`      Subcategory: ${p.subcategory || 'N/A'}`, 'cyan');
    });
  } else {
    log('   ⚠️  No products found by category search', 'yellow');
    
    // Try direct category search
    log(`\n   Trying direct category search...`, 'yellow');
    const { searchProductsByCategories } = await import('./src/services/productService.js');
    const directResults = await searchProductsByCategories(normalizedCategories, { limit: 10 });
    log(`   Direct search found: ${directResults.length} products`, directResults.length > 0 ? 'green' : 'red');
    
    if (directResults.length > 0) {
      directResults.slice(0, 5).forEach((p, i) => {
        log(`   ${i + 1}. ${p.name} (${p.category} / ${p.subcategory})`, 'green');
      });
    }
  }

  // Step 4: Test with species
  log(`\n4️⃣ Testing with Species Filter:`, 'cyan');
  const productsWithSpecies = await searchProductsWithIntent(testMessage, intentData, { 
    species: 'perro',
    limit: 5 
  });
  log(`   Found: ${productsWithSpecies.length} products (with species=perro)`, 
    productsWithSpecies.length > 0 ? 'green' : 'yellow');
}

testWithLogs().catch(error => {
  log(`\n❌ Error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
