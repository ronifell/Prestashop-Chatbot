/**
 * Render a veterinary clinic card
 * @param {Object} clinic
 * @returns {string} HTML string
 */
export function renderClinicCard(clinic) {
  return `
    <div class="bg-white rounded-xl border border-blue-200 p-3 ${clinic.isEmergency ? 'border-red-300 bg-red-50' : ''}">
      <div class="flex items-start gap-2">
        <span class="text-lg flex-shrink-0">${clinic.isEmergency ? '🚨' : '🏥'}</span>
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-sm text-slate-800">${clinic.name}</h4>
          ${clinic.isEmergency ? '<span class="inline-block bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">Urgencias 24h</span>' : ''}
          ${clinic.address ? `<p class="text-xs text-slate-600 mt-1">📍 ${clinic.address}${clinic.city ? `, ${clinic.city}` : ''}${clinic.province ? ` (${clinic.province})` : ''}</p>` : ''}
          <div class="flex flex-wrap gap-2 mt-2">
            ${clinic.phone ? `<a href="tel:${clinic.phone}" class="inline-flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">📞 ${clinic.phone}</a>` : ''}
            ${clinic.website ? `<a href="${clinic.website}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs bg-slate-600 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors">🌐 Web</a>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a list of clinic cards
 */
export function renderClinicCards(clinics) {
  if (!clinics || clinics.length === 0) return '';

  const cards = clinics.map(renderClinicCard).join('');
  return `
    <div class="mt-3 space-y-2">
      <p class="text-xs font-medium text-blue-600 uppercase tracking-wide">🏥 Clínicas veterinarias:</p>
      <div class="space-y-2">${cards}</div>
    </div>
  `;
}
