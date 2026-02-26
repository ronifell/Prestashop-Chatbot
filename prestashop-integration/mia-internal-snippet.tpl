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
  {* 
   * PRODUCCIÓN: Cargar el chatbot desde el VPS
   * Reemplaza http://212.227.108.25:3001 con tu URL de VPS
   * Actualiza el hash del archivo después de hacer 'npm run build'
   *}
  <script>
    // Configurar la URL del backend API si es necesario (ver mia-homepage-snippet.tpl)
    // window.MIA_API_BASE = 'http://212.227.108.25:3001/api';
  </script>
  <script type="module" src="http://212.227.108.25:3001/assets/mia-chat-[hash].js"></script>
{/if}
