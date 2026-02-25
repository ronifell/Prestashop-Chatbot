/**
 * API Service
 * Handles all communication with the MIA backend.
 */

const API_BASE = '/api';

/**
 * Send a chat message
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.message
 * @param {string|null} params.conversationId
 * @param {Object|null} params.productContext
 * @returns {Object} - API response
 */
export async function sendMessage({ sessionId, message, conversationId, productContext }) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      message,
      conversationId,
      productContext,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}`);
  }

  return response.json();
}

/**
 * Get the welcome message
 */
export async function getWelcome() {
  const response = await fetch(`${API_BASE}/chat/welcome`);
  if (!response.ok) throw new Error('No se pudo cargar el mensaje de bienvenida');
  return response.json();
}

/**
 * Search products
 */
export async function searchProducts(query, filters = {}) {
  const params = new URLSearchParams({ q: query, ...filters });
  const response = await fetch(`${API_BASE}/products/search?${params}`);
  if (!response.ok) throw new Error('Error al buscar productos');
  return response.json();
}

/**
 * Find clinics by postal code
 */
export async function findClinics(postalCode) {
  const response = await fetch(`${API_BASE}/clinics/${postalCode}`);
  if (!response.ok) throw new Error('Error al buscar clínicas');
  return response.json();
}

/**
 * Health check
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE}/chat/health`);
  return response.json();
}
