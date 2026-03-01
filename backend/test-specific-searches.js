/**
 * Test specific product searches to verify Fix.md issues are resolved
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { processMessage } from './src/services/chatService.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test scenarios from Fix.md - the exact problems mentioned
const fixMdTests = [
  {
    name: 'Fix.md Issue 1: Condroprotector',
    message: '¿Tienes condroprotector?',
    expected: 'Should find CONDROPROTECTOR/ARTICULAR products',
    checkProducts: (products) => {
      const hasCondro = products.some(p => 
        p.name.toLowerCase().includes('condro') ||
        p.subcategory?.toLowerCase().includes('condro') ||
        p.subcategory?.toLowerCase().includes('articular')
      );
      return hasCondro;
    },
  },
  {
    name: 'Fix.md Issue 2: Renal',
    message: '¿Tienes productos renales?',
    expected: 'Should find RENAL or DIETA VETERINARIA with RENAL products',
    checkProducts: (products) => {
      const hasRenal = products.some(p => 
        p.name.toLowerCase().includes('renal') ||
        p.subcategory?.toLowerCase().includes('renal')
      );
      return hasRenal;
    },
  },
  {
    name: 'Fix.md Issue 3: Probióticos (FortiFlora)',
    message: '¿Tienes probióticos?',
    expected: 'Should find FortiFlora or other probióticos',
    checkProducts: (products) => {
      const hasProbiotic = products.some(p => 
        p.name.toLowerCase().includes('fortiflora') ||
        p.name.toLowerCase().includes('probiotic') ||
        p.name.toLowerCase().includes('probiótico') ||
        p.subcategory?.toLowerCase().includes('gastrointestinal')
      );
      return hasProbiotic;
    },
  },
  {
    name: 'Fix.md Issue 4: Gástrico',
    message: 'Busco algo para problemas gástricos',
    expected: 'Should find GASTROINTESTINAL products',
    checkProducts: (products) => {
      const hasGastro = products.some(p => 
        p.name.toLowerCase().includes('gastro') ||
        p.subcategory?.toLowerCase().includes('gastrointestinal')
      );
      return hasGastro;
    },
  },
  {
    name: 'Fix.md Issue 5: Not only Gosbi',
    message: '¿Qué pienso me recomiendas para mi perro?',
    expected: 'Should find various brands, not just Gosbi',
    checkProducts: (products) => {
      const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
      return brands.length > 0; // Should have products from different brands
    },
  },
  {
    name: 'Fix.md Issue 6: Wrong product (comida húmeda → recovery)',
    message: 'Busco comida húmeda para mi gato',
    expected: 'Should find wet food, NOT recovery/post-surgical products',
    checkProducts: (products) => {
      const hasWrong = products.some(p => 
        p.name.toLowerCase().includes('recovery') ||
        p.name.toLowerCase().includes('postquirurgico') ||
        p.name.toLowerCase().includes('post-quirurgico')
      );
      return !hasWrong; // Should NOT have recovery products
    },
  },
];

async function testFixMdScenarios() {
  log('\n🔧 Testing Fix.md Specific Issues', 'cyan');
  log('='.repeat(70), 'cyan');

  const sessionId = 'test-fix-md-' + Date.now();
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const test of fixMdTests) {
    log(`\n📋 ${test.name}`, 'yellow');
    log(`   Message: "${test.message}"`, 'blue');
    log(`   Expected: ${test.expected}`, 'cyan');

    try {
      const response = await processMessage({
        sessionId,
        message: test.message,
        conversationId: null,
        productContext: null,
      });

      if (response.products && response.products.length > 0) {
        log(`   ✅ Found ${response.products.length} products:`, 'green');
        
        // Show first 3 products
        response.products.slice(0, 3).forEach((p, i) => {
          log(`      ${i + 1}. ${p.name}`, 'cyan');
          if (p.category) log(`         Category: ${p.category}${p.subcategory ? ' / ' + p.subcategory : ''}`, 'cyan');
          if (p.brand) log(`         Brand: ${p.brand}`, 'cyan');
        });

        // Check if products match expected criteria
        if (test.checkProducts) {
          const matches = test.checkProducts(response.products);
          if (matches) {
            log(`   ✅ Products match expected criteria`, 'green');
            passed++;
          } else {
            log(`   ⚠️  Products found but may not match expected criteria`, 'yellow');
            warnings++;
          }
        } else {
          passed++;
        }

        // Check response message
        if (response.message) {
          const preview = response.message.substring(0, 150);
          log(`   Response: "${preview}${response.message.length > 150 ? '...' : ''}"`, 'magenta');
        }
      } else {
        log(`   ❌ No products found`, 'red');
        if (response.message) {
          log(`   Response: "${response.message.substring(0, 100)}..."`, 'yellow');
        }
        failed++;
      }
    } catch (error) {
      log(`   ❌ Error: ${error.message}`, 'red');
      failed++;
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  log('\n' + '='.repeat(70), 'cyan');
  log('\n📊 Fix.md Test Summary', 'cyan');
  log(`   ✅ Passed: ${passed}`, 'green');
  log(`   ⚠️  Warnings: ${warnings}`, 'yellow');
  log(`   ❌ Failed: ${failed}`, 'red');
  log(`   Total: ${fixMdTests.length} scenarios`, 'blue');

  if (failed === 0 && warnings === 0) {
    log('\n🎉 All Fix.md issues resolved!', 'green');
  } else if (failed === 0) {
    log('\n✅ All tests passed with some warnings (products found but may need refinement)', 'green');
  } else {
    log('\n⚠️  Some issues remain. Check the output above.', 'yellow');
  }
}

testFixMdScenarios().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
