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

{* Cargar estilos y script del chatbot *}
<link rel="stylesheet" href="http://212.227.108.25:5173/src/style.css" />
<script type="module" src="http://212.227.108.25:5173/src/main.js"></script>

{* En producción (tras hacer build), usa las rutas del dist: *}
{* <link rel="stylesheet" href="http://212.227.108.25:3001/assets/mia-chat.css" /> *}
{* <script type="module" src="http://212.227.108.25:3001/assets/mia-chat.js"></script> *}
