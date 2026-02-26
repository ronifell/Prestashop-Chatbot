{**
 * MIA Chatbot - PrestaShop Homepage Integration Snippet
 * 
 * INSTRUCCIONES:
 * 1. Coloca este bloque en tu tema de PrestaShop, en la plantilla de la homepage
 *    (normalmente en themes/your-theme/templates/index.tpl o similar).
 * 2. Debe ir como primer bloque visible (hero) justo después del <body> o header.
 * 3. Ajusta la URL del script al dominio del VPS donde está el chatbot.
 *
 * Para páginas internas (producto, categoría, etc.), usa mia-internal-snippet.tpl
 *}

{* Hero Chat Block - visible al cargar la página principal *}
<div id="mia-chat-hero"></div>

{* 
 * PRODUCCIÓN: Cargar el chatbot desde el VPS
 * Reemplaza http://212.227.108.25:3001 con tu URL de VPS
 * Si usas HTTPS, cambia a https://
 *}
<script>
  // Configurar la URL del backend API si es diferente del dominio actual
  // Si el frontend se carga desde el mismo dominio que el backend, no es necesario
  // Si se carga desde PrestaShop (diferente dominio), descomenta y ajusta:
  // window.MIA_API_BASE = 'http://212.227.108.25:3001/api';
</script>
<link rel="stylesheet" href="http://212.227.108.25:3001/assets/mia-chat-[hash].css" />
<script type="module" src="http://212.227.108.25:3001/assets/mia-chat-[hash].js"></script>

{* 
 * NOTA: Los archivos tienen hash en el nombre (ej: mia-chat-a1b2c3.js)
 * Después de hacer 'npm run build' en frontend/, actualiza los nombres de archivo aquí
 * O mejor aún, usa un script que inyecte automáticamente los nombres correctos
 *}
