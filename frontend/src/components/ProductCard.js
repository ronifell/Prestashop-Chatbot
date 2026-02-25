import { formatPrice } from '../utils/helpers.js';

/**
 * Render a product recommendation card
 * @param {Object} product
 * @returns {string} HTML string
 */
export function renderProductCard(product) {
  const price = product.price ? formatPrice(product.price) : '';
  const prescriptionBadge = product.requiresPrescription
    ? '<span class="inline-block bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">⚠️ Receta</span>'
    : '';

  return `
    <div class="mia-product-card bg-white rounded-xl border border-slate-200 p-3 flex gap-3 items-start">
      ${product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-slate-100" onerror="this.style.display='none'" />`
        : '<div class="w-16 h-16 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0"><span class="text-2xl">🐾</span></div>'
      }
      <div class="flex-1 min-w-0">
        <h4 class="font-semibold text-sm text-slate-800 truncate">${product.name}</h4>
        <div class="flex items-center gap-2 mt-1">
          ${price ? `<span class="text-teal-700 font-bold text-sm">${price}</span>` : ''}
          ${prescriptionBadge}
        </div>
        ${product.species ? `<p class="text-xs text-slate-500 mt-0.5">${product.species}</p>` : ''}
        <div class="flex gap-2 mt-2">
          ${product.productUrl
            ? `<a href="${product.productUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors">
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                 Ver
               </a>`
            : ''}
          ${product.addToCartUrl
            ? `<a href="${product.addToCartUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors">
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/></svg>
                 Añadir
               </a>`
            : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a horizontal list of product cards
 */
export function renderProductCards(products) {
  if (!products || products.length === 0) return '';

  const cards = products.map(renderProductCard).join('');
  return `
    <div class="mt-3 space-y-2">
      <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Productos recomendados:</p>
      <div class="space-y-2">${cards}</div>
    </div>
  `;
}
