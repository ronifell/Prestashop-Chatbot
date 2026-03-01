/**
 * Unit tests for MIA Chatbot Services
 * Tests intent detection, product search logic, and other services
 * without requiring the full server to be running
 */

import { detectIntent, getNormalizedCategoryNames } from './src/services/intentService.js';
import { normalizeText } from './src/utils/textNormalizer.js';

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

// Test Intent Detection
function testIntentDetection() {
  log('\n📋 Testing Intent Detection', 'cyan');
  log('='.repeat(60), 'cyan');

  const intentTests = [
    { message: '¿Tienes condroprotector?', expectedIntent: 'JOINTS_CONDROPROTECTOR' },
    { message: 'Busco algo para articulaciones', expectedIntent: 'JOINTS_CONDROPROTECTOR' },
    { message: 'Necesito condrovet', expectedIntent: 'JOINTS_CONDROPROTECTOR' },
    { message: '¿Tienes productos renales?', expectedIntent: 'DIET_RENAL' },
    { message: 'Busco pienso para insuficiencia renal', expectedIntent: 'DIET_RENAL' },
    { message: '¿Tienes probióticos?', expectedIntent: 'GI_GASTROINTESTINAL' },
    { message: 'Busco fortiflora', expectedIntent: 'GI_GASTROINTESTINAL' },
    { message: 'Mi gato tiene diarrea', expectedIntent: 'GI_GASTROINTESTINAL' },
    { message: '¿Tienes productos para diabetes?', expectedIntent: 'DIET_DIABETES' },
    { message: 'Necesito algo hipoalergénico', expectedIntent: 'DIET_HYPOALLERGENIC' },
    { message: 'Mi gato tiene alergia alimentaria', expectedIntent: 'DIET_HYPOALLERGENIC' },
    { message: '¿Tienes algo para mal aliento?', expectedIntent: 'DENTAL_HALITOSIS' },
    { message: 'Necesito limpiar los oídos de mi perro', expectedIntent: 'EAR_OTIC' },
    { message: '¿Qué antiparasitario me recomiendas?', expectedIntent: 'PARASITES_EXTERNAL' },
    { message: 'Busco pipeta para pulgas', expectedIntent: 'PARASITES_EXTERNAL' },
    { message: '¿Cuánto cuesta el envío?', expectedIntent: 'SUPPORT_SHOP' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of intentTests) {
    const result = detectIntent(test.message);
    const intent = result.intent;
    
    if (intent === test.expectedIntent) {
      log(`  ✅ "${test.message.substring(0, 50)}" → ${intent}`, 'green');
      passed++;
    } else {
      log(`  ❌ "${test.message.substring(0, 50)}"`, 'red');
      log(`     Expected: ${test.expectedIntent}, Got: ${intent || 'none'}`, 'red');
      failed++;
    }
  }

  log(`\n  Results: ${passed} passed, ${failed} failed`, passed === intentTests.length ? 'green' : 'yellow');
  return { passed, failed, total: intentTests.length };
}

// Test Category Normalization
function testCategoryNormalization() {
  log('\n📋 Testing Category Normalization', 'cyan');
  log('='.repeat(60), 'cyan');

  const categoryTests = [
    {
      input: [['CONDROPROTECTOR/ARTICULAR']],
      expected: ['CONDROPROTECTOR/ARTICULAR'],
    },
    {
      input: [['DIETA VETERINARIA'], ['SALUD', 'RENAL']],
      expected: ['DIETA VETERINARIA', 'SALUD', 'RENAL'],
    },
    {
      input: [['DERMATOLOGIA'], ['DERMATOLOGÍA']],
      expected: ['DERMATOLOGÍA'], // Should normalize to same
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of categoryTests) {
    const result = getNormalizedCategoryNames(test.input);
    const normalized = result.sort();
    const expected = test.expected.sort();
    
    if (JSON.stringify(normalized) === JSON.stringify(expected)) {
      log(`  ✅ Categories normalized correctly`, 'green');
      passed++;
    } else {
      log(`  ❌ Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(normalized)}`, 'red');
      failed++;
    }
  }

  log(`\n  Results: ${passed} passed, ${failed} failed`, passed === categoryTests.length ? 'green' : 'yellow');
  return { passed, failed, total: categoryTests.length };
}

// Test Text Normalization
function testTextNormalization() {
  log('\n📋 Testing Text Normalization', 'cyan');
  log('='.repeat(60), 'cyan');

  const normalizationTests = [
    { input: '¿Qué DOSIS le doy?', expected: 'que dosis le doy' },
    { input: '¡¡¡CONVULSIONES!!!', expected: 'convulsiones' },
    { input: 'Mi gato está ENVENENADO...', expected: 'mi gato esta envenenado' },
    { input: 'DIAGNÓSTICO urgente', expected: 'diagnostico urgente' },
    { input: '¿Necesita receta?', expected: 'necesita receta' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of normalizationTests) {
    const result = normalizeText(test.input);
    
    if (result === test.expected) {
      log(`  ✅ "${test.input}" → "${result}"`, 'green');
      passed++;
    } else {
      log(`  ❌ "${test.input}"`, 'red');
      log(`     Expected: "${test.expected}", Got: "${result}"`, 'red');
      failed++;
    }
  }

  log(`\n  Results: ${passed} passed, ${failed} failed`, passed === normalizationTests.length ? 'green' : 'yellow');
  return { passed, failed, total: normalizationTests.length };
}

// Test Red Flag Detection (if available)
async function testRedFlagDetection() {
  log('\n📋 Testing Red Flag Detection', 'cyan');
  log('='.repeat(60), 'cyan');

  try {
    const { detectRedFlags } = await import('./src/services/redFlagService.js');
    
    const redFlagTests = [
      { message: 'Mi perro no respira', shouldDetect: true },
      { message: 'Mi gato tiene convulsiones', shouldDetect: true },
      { message: 'Mi perro vomita sangre', shouldDetect: true },
      { message: '¿Qué antiparasitario me recomiendas?', shouldDetect: false },
      { message: 'Busco condroprotector', shouldDetect: false },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of redFlagTests) {
      const result = await detectRedFlags(test.message);
      
      if (result.isRedFlag === test.shouldDetect) {
        log(`  ✅ "${test.message.substring(0, 50)}" → Red flag: ${result.isRedFlag}`, 'green');
        passed++;
      } else {
        log(`  ❌ "${test.message.substring(0, 50)}"`, 'red');
        log(`     Expected red flag: ${test.shouldDetect}, Got: ${result.isRedFlag}`, 'red');
        failed++;
      }
    }

    log(`\n  Results: ${passed} passed, ${failed} failed`, passed === redFlagTests.length ? 'green' : 'yellow');
    return { passed, failed, total: redFlagTests.length };
  } catch (error) {
    log(`  ⚠️  Could not test red flags: ${error.message}`, 'yellow');
    return { passed: 0, failed: 0, total: 0 };
  }
}

// Run all tests
async function runAllTests() {
  log('\n🧪 MIA Chatbot Service Tests', 'cyan');
  log('='.repeat(60), 'cyan');
  log('Testing services without requiring full server\n', 'blue');

  const results = {
    intent: testIntentDetection(),
    categories: testCategoryNormalization(),
    normalization: testTextNormalization(),
    redFlags: await testRedFlagDetection(),
  };

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('\n📊 Test Summary', 'cyan');
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;

  for (const [name, result] of Object.entries(results)) {
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalTests += result.total;
    const status = result.failed === 0 ? '✅' : '⚠️';
    log(`  ${status} ${name}: ${result.passed}/${result.total} passed`, result.failed === 0 ? 'green' : 'yellow');
  }

  log(`\n  Total: ${totalPassed}/${totalTests} tests passed`, totalFailed === 0 ? 'green' : 'yellow');

  if (totalFailed === 0) {
    log('\n🎉 All service tests passed!', 'green');
  } else {
    log(`\n⚠️  ${totalFailed} test(s) failed`, 'yellow');
  }

  log('\n💡 To test the full bot with API calls:', 'blue');
  log('   1. Start the server: npm start', 'blue');
  log('   2. Run API tests: npm test', 'blue');
}

runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
