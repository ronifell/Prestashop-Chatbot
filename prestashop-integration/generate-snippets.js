/**
 * Script para generar snippets de PrestaShop con los nombres correctos de archivos
 * después de hacer 'npm run build' en el frontend.
 * 
 * Uso: node generate-snippets.js <VPS_URL>
 * Ejemplo: node generate-snippets.js http://212.227.108.25:3001
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const vpsUrl = process.argv[2] || 'http://212.227.108.25:3001';
const manifestPath = join(__dirname, '../frontend/dist/.vite/manifest.json');

try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  
  // Buscar el archivo principal (main.js)
  const mainEntry = Object.keys(manifest).find(key => 
    key.includes('main.js') || key.includes('index.html')
  );
  
  let jsFile = 'assets/mia-chat-[hash].js';
  let cssFile = 'assets/mia-chat.css';
  
  if (mainEntry && manifest[mainEntry]) {
    jsFile = manifest[mainEntry].file;
    
    // Buscar CSS asociado
    if (manifest[mainEntry].css && manifest[mainEntry].css.length > 0) {
      cssFile = manifest[mainEntry].css[0];
    }
  }
  
  // Generar snippet para homepage
  const homepageSnippet = `{**
 * MIA Chatbot - PrestaShop Homepage Integration Snippet
 * 
 * INSTRUCCIONES:
 * 1. Coloca este bloque en tu tema de PrestaShop, en la plantilla de la homepage
 *    (normalmente en themes/your-theme/templates/index.tpl o similar).
 * 2. Debe ir como primer bloque visible (hero) justo después del <body> o header.
 * 3. Este archivo fue generado automáticamente después de 'npm run build'
 *
 * Para páginas internas (producto, categoría, etc.), usa mia-internal-snippet.tpl
 *}

{* Hero Chat Block - visible al cargar la página principal *}
<div id="mia-chat-hero"></div>

{* Cargar estilos y script del chatbot desde VPS *}
<script>
  // Configurar la URL del backend API si el frontend se carga desde PrestaShop
  // (diferente dominio que el backend)
  window.MIA_API_BASE = '${vpsUrl}/api';
</script>
<link rel="stylesheet" href="${vpsUrl}/${cssFile}" />
<script type="module" src="${vpsUrl}/${jsFile}"></script>
`;

  // Generar snippet para páginas internas
  const internalSnippet = `{**
 * MIA Chatbot - PrestaShop Internal Pages Integration
 * 
 * INSTRUCCIONES:
 * Coloca este snippet en el footer de tu tema PrestaShop
 * (themes/your-theme/templates/layouts/layout-both-columns.tpl o layout-full-width.tpl)
 * para que el widget flotante aparezca en todas las páginas internas.
 * 
 * NO incluir este snippet en la homepage si ya usas mia-homepage-snippet.tpl
 * Este archivo fue generado automáticamente después de 'npm run build'
 *}

{* Widget flotante - NO incluir si la homepage ya tiene el hero *}
{if $page.page_name != 'index'}
  <script>
    // Configurar la URL del backend API si es necesario
    window.MIA_API_BASE = '${vpsUrl}/api';
  </script>
  <script type="module" src="${vpsUrl}/${jsFile}"></script>
{/if}
`;

  // Guardar snippets
  writeFileSync(
    join(__dirname, 'mia-homepage-snippet-generated.tpl'),
    homepageSnippet
  );
  
  writeFileSync(
    join(__dirname, 'mia-internal-snippet-generated.tpl'),
    internalSnippet
  );
  
  console.log('✅ Snippets generados correctamente:');
  console.log(`   - mia-homepage-snippet-generated.tpl`);
  console.log(`   - mia-internal-snippet-generated.tpl`);
  console.log(`\n📦 Archivos referenciados:`);
  console.log(`   - JS: ${jsFile}`);
  console.log(`   - CSS: ${cssFile}`);
  console.log(`\n🔗 URL base: ${vpsUrl}`);
  console.log(`\n💡 Copia estos snippets a tu tema de PrestaShop.`);
  
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error('❌ Error: No se encontró el manifest.json');
    console.error('   Asegúrate de haber ejecutado "npm run build" en frontend/');
    console.error(`   Buscado en: ${manifestPath}`);
  } else {
    console.error('❌ Error:', error.message);
  }
  process.exit(1);
}
