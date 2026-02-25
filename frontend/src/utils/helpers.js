/**
 * Generate a unique session ID
 * Persists in localStorage so the session survives page refreshes
 */
export function getSessionId() {
  const KEY = 'mia_session_id';
  let sessionId = localStorage.getItem(KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem(KEY, sessionId);
  }
  return sessionId;
}

/**
 * Generate a unique message ID
 */
export function generateMessageId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get current product context from PrestaShop page (if applicable)
 * This function extracts product info from the current PrestaShop product page.
 * It should be adapted based on the actual PrestaShop theme structure.
 */
export function getProductContext() {
  // Try to detect if we're on a product page (PrestaShop)
  try {
    // PrestaShop typically has product data in a global JS variable
    if (typeof prestashop !== 'undefined' && prestashop.product) {
      return {
        id: prestashop.product.id,
        name: prestashop.product.name,
        price: prestashop.product.price_amount,
        category: prestashop.product.category_name,
        description: prestashop.product.description_short,
        url: window.location.href,
      };
    }

    // Fallback: try to extract from meta tags or DOM
    const productName = document.querySelector('h1.product-title, h1[itemprop="name"]')?.textContent?.trim();
    const productPrice = document.querySelector('.product-price, [itemprop="price"]')?.getAttribute('content');

    if (productName) {
      return {
        name: productName,
        price: productPrice,
        url: window.location.href,
      };
    }
  } catch (_) {}

  return null;
}

/**
 * Format price with euro symbol
 */
export function formatPrice(price) {
  if (!price && price !== 0) return '';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
