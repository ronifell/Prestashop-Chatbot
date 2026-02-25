{**
 * MIA Chatbot - PrestaShop Internal Pages Integration
 * 
 * INSTRUCCIONES:
 * Coloca este snippet en el footer de tu tema PrestaShop
 * (themes/your-theme/templates/layouts/layout-both-columns.tpl o layout-full-width.tpl)
 * para que el widget flotante aparezca en todas las páginas internas.
 * 
 * NO incluir este snippet en la homepage si ya usas mia-homepage-snippet.tpl
 *}

{* Widget flotante - NO incluir si la homepage ya tiene el hero *}
{if $page.page_name != 'index'}
  <script type="module" src="http://212.227.108.25:5173/src/main.js"></script>
{/if}
