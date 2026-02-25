import { marked } from 'marked';
import { sendMessage, getWelcome } from '../services/api.js';
import { getSessionId, generateMessageId, getProductContext, escapeHtml } from '../utils/helpers.js';
import { renderProductCards } from './ProductCard.js';
import { renderClinicCards } from './ClinicCard.js';

/**
 * ChatHero - Main homepage chat component
 * Renders as a hero block, not a floating widget.
 */

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

// State
let conversationId = null;
let isLoading = false;
let messages = [];

const sessionId = getSessionId();

/**
 * Initialize and render the hero chat
 * @param {string} containerId - DOM element ID to mount into
 */
export function initChatHero(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('MIA Chat: Container not found:', containerId);
    return;
  }

  container.innerHTML = renderHeroHTML();
  bindEvents(container);
  loadWelcomeMessage();
}

/**
 * Render the full hero HTML structure
 */
function renderHeroHTML() {
  return `
    <section class="mia-hero-gradient py-8 md:py-12 px-4 relative overflow-hidden">
      <!-- Background decorative elements -->
      <div class="absolute inset-0 opacity-10">
        <div class="absolute top-10 left-10 text-6xl">🐾</div>
        <div class="absolute top-20 right-20 text-5xl">🐕</div>
        <div class="absolute bottom-10 left-1/4 text-5xl">🐈</div>
        <div class="absolute bottom-20 right-10 text-4xl">🐾</div>
      </div>

      <div class="max-w-4xl mx-auto relative z-10">
        <!-- Header -->
        <div class="text-center mb-6">
          <div class="inline-flex items-center gap-3 mb-3">
            <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <span class="text-2xl">🐾</span>
            </div>
            <div class="text-left">
              <h1 class="text-2xl md:text-3xl font-bold text-white">
                MIA
              </h1>
              <p class="text-teal-100 text-sm">Tu asistente veterinaria</p>
            </div>
          </div>
          <p class="text-teal-50 text-sm md:text-base max-w-lg mx-auto">
            Te ayudo a elegir el mejor producto para tu mascota. 
            Pregúntame sobre nutrición, antiparasitarios, higiene y más.
          </p>
        </div>

        <!-- Chat Window -->
        <div class="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-2xl mx-auto border border-white/20">
          <!-- Chat Header Bar -->
          <div class="bg-teal-700 px-4 py-3 flex items-center gap-3">
            <div class="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
              <span class="text-lg">🐾</span>
            </div>
            <div>
              <h2 class="text-white font-semibold text-sm">MIA - Asistente Veterinaria</h2>
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 bg-green-400 rounded-full"></span>
                <span class="text-teal-200 text-xs">En línea</span>
              </div>
            </div>
          </div>

          <!-- Messages Area -->
          <div id="mia-messages" class="mia-messages-scroll h-[400px] md:h-[450px] overflow-y-auto p-4 space-y-3 bg-slate-50">
            <!-- Messages will be injected here -->
          </div>

          <!-- Input Area -->
          <div class="border-t border-slate-200 bg-white p-3">
            <!-- Legal Disclaimer -->
            <div class="mb-2 px-2">
              <p class="text-xs text-slate-400 text-center">
                ❗ No realizamos diagnósticos ni prescripciones. Este asistente orienta sobre productos.
              </p>
            </div>
            
            <form id="mia-chat-form" class="flex gap-2">
              <input
                type="text"
                id="mia-chat-input"
                class="mia-input-ring flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 bg-white transition-shadow"
                placeholder="Escribe tu consulta aquí..."
                maxlength="2000"
                autocomplete="off"
              />
              <button
                type="submit"
                id="mia-send-btn"
                class="bg-teal-600 hover:bg-teal-700 text-white px-5 py-3 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Enviar</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </form>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="max-w-2xl mx-auto mt-4 flex flex-wrap justify-center gap-2" id="mia-quick-actions">
          <button class="mia-quick-btn bg-white/15 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full hover:bg-white/25 transition-colors border border-white/20" data-message="¿Qué antiparasitario me recomiendas para mi perro?">
            🛡️ Antiparasitarios
          </button>
          <button class="mia-quick-btn bg-white/15 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full hover:bg-white/25 transition-colors border border-white/20" data-message="¿Qué alimentación es mejor para mi gato adulto?">
            🍽️ Alimentación
          </button>
          <button class="mia-quick-btn bg-white/15 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full hover:bg-white/25 transition-colors border border-white/20" data-message="¿Qué productos de higiene necesito para mi mascota?">
            🧴 Higiene
          </button>
          <button class="mia-quick-btn bg-white/15 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-full hover:bg-white/25 transition-colors border border-white/20" data-message="¿Qué suplementos recomiendas para un perro senior?">
            💊 Suplementos
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * Bind all event handlers
 */
function bindEvents(container) {
  // Form submit
  const form = container.querySelector('#mia-chat-form');
  form.addEventListener('submit', handleSubmit);

  // Enter key (but allow Shift+Enter for newline)
  const input = container.querySelector('#mia-chat-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });

  // Quick action buttons
  const quickBtns = container.querySelectorAll('.mia-quick-btn');
  quickBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const message = btn.dataset.message;
      if (message) {
        input.value = message;
        form.dispatchEvent(new Event('submit'));
      }
    });
  });
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();

  const input = document.getElementById('mia-chat-input');
  const message = input.value.trim();

  if (!message || isLoading) return;

  // Clear input
  input.value = '';

  // Add user message to UI
  addMessage('user', message);

  // Show typing indicator
  showTyping();

  // Disable input while processing
  setLoading(true);

  try {
    const productContext = getProductContext();

    const result = await sendMessage({
      sessionId,
      message,
      conversationId,
      productContext,
    });

    // Remove typing indicator
    hideTyping();

    if (result.success) {
      const data = result.data;
      conversationId = data.conversationId;

      // Add assistant message
      addMessage('assistant', data.message, {
        responseType: data.responseType,
        products: data.products,
        clinics: data.clinics,
      });
    } else {
      addMessage('assistant', 'Lo siento, ha ocurrido un error. Por favor, inténtalo de nuevo.', {
        responseType: 'error',
      });
    }
  } catch (error) {
    hideTyping();
    console.error('MIA Chat error:', error);
    addMessage(
      'assistant',
      'Disculpa, no he podido procesar tu mensaje. Comprueba tu conexión e inténtalo de nuevo.',
      { responseType: 'error' }
    );
  } finally {
    setLoading(false);
    input.focus();
  }
}

/**
 * Load and display the welcome message
 */
async function loadWelcomeMessage() {
  try {
    const result = await getWelcome();
    if (result.success) {
      addMessage('assistant', result.data.message, { responseType: 'welcome' });
    }
  } catch (error) {
    // Fallback welcome message
    addMessage(
      'assistant',
      '¡Hola! 👋 Soy **MIA**, tu asistente veterinaria en la tienda.\n\nPuedo asesorarte sobre nutrición, antiparasitarios, higiene y cuidados generales para tu mascota.\n\n❗ **No realizamos diagnósticos ni prescripciones.**\n\n¿En qué puedo ayudarte hoy?',
      { responseType: 'welcome' }
    );
  }
}

/**
 * Add a message to the chat UI
 */
function addMessage(role, content, options = {}) {
  const { responseType, products, clinics } = options;

  const msgId = generateMessageId();
  messages.push({ id: msgId, role, content, responseType, products, clinics });

  const messagesContainer = document.getElementById('mia-messages');
  if (!messagesContainer) return;

  const messageHTML = renderMessage(role, content, responseType, products, clinics);
  const wrapper = document.createElement('div');
  wrapper.className = 'mia-message-enter';
  wrapper.innerHTML = messageHTML;
  messagesContainer.appendChild(wrapper);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Render a single message bubble
 */
function renderMessage(role, content, responseType, products, clinics) {
  if (role === 'user') {
    return `
      <div class="flex justify-end">
        <div class="bg-teal-600 text-white rounded-2xl rounded-br-md px-4 py-3 max-w-[85%] shadow-sm">
          <p class="text-sm whitespace-pre-wrap">${escapeHtml(content)}</p>
        </div>
      </div>
    `;
  }

  // Assistant message
  const isEmergency = responseType === 'emergency_warning';
  const isLimit = ['medical_limit', 'rx_limit', 'vet_referral'].includes(responseType);

  let borderClass = 'border-slate-200';
  let bgClass = 'bg-white';
  let iconBg = 'bg-teal-100';
  let extraClass = '';

  if (isEmergency) {
    borderClass = 'border-red-300';
    bgClass = 'bg-red-50';
    iconBg = 'bg-red-100';
    extraClass = 'mia-emergency-pulse';
  } else if (isLimit) {
    borderClass = 'border-amber-200';
    bgClass = 'bg-amber-50';
    iconBg = 'bg-amber-100';
  }

  // Parse markdown in assistant messages
  const htmlContent = marked.parse(content);

  // Render product cards if present
  const productCardsHTML = products && products.length > 0 ? renderProductCards(products) : '';

  // Render clinic cards if present
  const clinicCardsHTML = clinics && clinics.length > 0 ? renderClinicCards(clinics) : '';

  return `
    <div class="flex justify-start gap-2 ${extraClass}">
      <div class="${iconBg} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
        <span class="text-sm">${isEmergency ? '🚨' : '🐾'}</span>
      </div>
      <div class="${bgClass} border ${borderClass} rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] shadow-sm">
        <div class="mia-markdown-content text-sm text-slate-700 leading-relaxed">
          ${htmlContent}
        </div>
        ${productCardsHTML}
        ${clinicCardsHTML}
      </div>
    </div>
  `;
}

/**
 * Show typing indicator
 */
function showTyping() {
  const messagesContainer = document.getElementById('mia-messages');
  if (!messagesContainer) return;

  const typingHTML = `
    <div id="mia-typing-indicator" class="flex justify-start gap-2 mia-message-enter">
      <div class="bg-teal-100 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
        <span class="text-sm">🐾</span>
      </div>
      <div class="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div class="flex gap-1.5 items-center h-5">
          <div class="mia-typing-dot w-2 h-2 bg-teal-400 rounded-full"></div>
          <div class="mia-typing-dot w-2 h-2 bg-teal-400 rounded-full"></div>
          <div class="mia-typing-dot w-2 h-2 bg-teal-400 rounded-full"></div>
        </div>
      </div>
    </div>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = typingHTML;
  messagesContainer.appendChild(wrapper.firstElementChild);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Hide typing indicator
 */
function hideTyping() {
  const typing = document.getElementById('mia-typing-indicator');
  if (typing) typing.remove();
}

/**
 * Set loading state
 */
function setLoading(loading) {
  isLoading = loading;
  const btn = document.getElementById('mia-send-btn');
  const input = document.getElementById('mia-chat-input');

  if (btn) btn.disabled = loading;
  if (input) input.disabled = loading;
}
