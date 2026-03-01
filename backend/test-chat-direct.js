/**
 * Direct Chat Service Testing
 * Tests the chat service directly without requiring the full server
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

import { processMessage } from './src/services/chatService.js';
import { detectIntent } from './src/services/intentService.js';

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

// Test scenarios from Fix.md
const testScenarios = [
  {
    name: 'Catalog Understanding - Condroprotector',
    message: '¿Tienes condroprotector?',
    expectedIntent: 'JOINTS_CONDROPROTECTOR',
    shouldFindProducts: true,
  },
  {
    name: 'Catalog Understanding - Renal',
    message: '¿Tienes productos renales?',
    expectedIntent: 'DIET_RENAL',
    shouldFindProducts: true,
  },
  {
    name: 'Catalog Understanding - Probióticos',
    message: '¿Tienes probióticos?',
    expectedIntent: 'GI_GASTROINTESTINAL',
    shouldFindProducts: true,
  },
  {
    name: 'Educational Question (Should NOT be blocked)',
    message: '¿Qué composición debe tener un pienso para diabetes?',
    shouldNotBlock: true,
    shouldBeEducational: true,
  },
  {
    name: 'Medical Request (Should be blocked)',
    message: '¿Qué dosis le doy a mi perro?',
    expectedType: 'medical_limit',
  },
  {
    name: 'Red Flag - Emergency',
    message: 'Mi perro no respira',
    expectedType: 'emergency_warning',
  },
  {
    name: 'Red Flag - Convulsiones',
    message: 'Mi gato tiene convulsiones',
    expectedType: 'emergency_warning',
  },
  {
    name: 'Normal Product Query',
    message: '¿Qué antiparasitario me recomiendas para mi perro?',
    expectedIntent: 'PARASITES_EXTERNAL',
    expectedType: 'normal',
  },
];

async function testScenario(scenario, sessionId) {
  log(`\n📋 ${scenario.name}`, 'cyan');
  log(`   Message: "${scenario.message}"`, 'blue');
  log('   ' + '-'.repeat(60), 'blue');

  try {
    // First test intent detection
    const intentResult = detectIntent(scenario.message);
    
    if (scenario.expectedIntent) {
      if (intentResult.intent === scenario.expectedIntent) {
        log(`   ✅ Intent detected correctly: ${intentResult.intent}`, 'green');
      } else {
        log(`   ❌ Expected intent: ${scenario.expectedIntent}, got: ${intentResult.intent || 'none'}`, 'red');
      }
    }

    // Then test full chat processing
    const response = await processMessage({
      sessionId,
      message: scenario.message,
      conversationId: null,
      productContext: null,
    });

    // Check response type
    if (scenario.expectedType) {
      if (response.responseType === scenario.expectedType) {
        log(`   ✅ Correct responseType: ${scenario.expectedType}`, 'green');
      } else {
        log(`   ❌ Expected responseType: ${scenario.expectedType}, got: ${response.responseType}`, 'red');
      }
    }

    // Check if should not be blocked
    if (scenario.shouldNotBlock) {
      if (response.responseType === 'medical_limit' || response.responseType === 'rx_limit') {
        log(`   ❌ Should NOT be blocked, but got: ${response.responseType}`, 'red');
      } else {
        log(`   ✅ Correctly NOT blocked`, 'green');
      }
    }

    // Check for products
    if (scenario.shouldFindProducts && response.products) {
      if (response.products.length > 0) {
        log(`   ✅ Found ${response.products.length} product(s)`, 'green');
        response.products.slice(0, 3).forEach((p, i) => {
          log(`      ${i + 1}. ${p.name}`, 'cyan');
        });
      } else {
        log(`   ⚠️  No products found (database may be empty)`, 'yellow');
      }
    }

    // Display response preview
    if (response.message) {
      const preview = response.message.substring(0, 200);
      log(`   Response: "${preview}${response.message.length > 200 ? '...' : ''}"`, 'magenta');
    }

    return {
      success: true,
      response,
    };
  } catch (error) {
    log(`   ❌ Error: ${error.message}`, 'red');
    if (error.stack) {
      log(`   Stack: ${error.stack.split('\n')[0]}`, 'red');
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runAllTests() {
  log('\n🧪 MIA Chatbot - Direct Service Testing', 'cyan');
  log('='.repeat(70), 'cyan');
  log('Testing chat service directly (requires database connection)\n', 'blue');

  const sessionId = 'test-session-' + Date.now();
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  for (const scenario of testScenarios) {
    const result = await testScenario(scenario, sessionId);
    
    if (result.success) {
      passed++;
    } else {
      failed++;
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  log('\n' + '='.repeat(70), 'cyan');
  log('\n📊 Test Summary', 'cyan');
  log(`   ✅ Passed: ${passed}`, 'green');
  log(`   ❌ Failed: ${failed}`, 'red');
  log(`   ⚠️  Warnings: ${warnings}`, 'yellow');
  log(`   Total: ${testScenarios.length} scenarios tested`, 'blue');

  if (failed === 0) {
    log('\n🎉 All tests completed successfully!', 'green');
  } else {
    log('\n⚠️  Some tests had errors. Check database connection and configuration.', 'yellow');
  }

  log('\n💡 Note: Product search requires database with products imported.', 'blue');
  log('   Run: npm run import:products (if you have product data)', 'blue');
}

runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
