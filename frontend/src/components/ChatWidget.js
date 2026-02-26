import { marked } from 'marked';
import { sendMessage, getWelcome } from '../services/api.js';
import { getSessionId, generateMessageId, getProductContext, escapeHtml } from '../utils/helpers.js';
import { renderProductCards } from './ProductCard.js';
import { renderClinicCards } from './ClinicCard.js';

/**
 * ChatWidget - Floating minimizable chat for internal/product pages.
 * Appears as a floating button in the bottom-right corner.
 */

marked.setOptions({ breaks: true, gfm: true });

let conversationId = null;
let isLoading = false;
let isOpen = false;
let messages = [];

const sessionId = getSessionId();

/**
 * Initialize the floating chat widget
 */
export function initChatWidget() {
  // Don't render widget if hero is present on homepage
  if (document.getElementById('mia-chat-hero')?.children.length > 0) {
    return;
  }

  const widget = document.createElement('div');
  widget.id = 'mia-chat-widget';
  widget.innerHTML = renderWidgetHTML();
  document.body.appendChild(widget);

  bindWidgetEvents();
}

function renderWidgetHTML() {
  return `
    <!-- Floating Button -->
    <button id="mia-widget-toggle" class="fixed bottom-6 right-6 w-14 h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50 hover:scale-110">
      <span id="mia-widget-icon-open" class="text-2xl">🐾</span>
      <span id="mia-widget-icon-close" class="text-xl hidden">✕</span>
    </button>

    <!-- Chat Panel -->
    <div id="mia-widget-panel" class="fixed bottom-24 right-6 w-[380px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 hidden border border-slate-200">
      <!-- Header -->
      <div class="bg-teal-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div class="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
          <span class="text-lg">🐾</span>
        </div>
        <div class="flex-1">
          <h2 class="text-white font-semibold text-sm">MIA - Asistente Veterinario</h2>
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 bg-green-400 rounded-full"></span>
            <span class="text-teal-200 text-xs">En línea</span>
          </div>
        </div>
        <button id="mia-widget-minimize" class="text-white/70 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>

      <!-- Messages -->
      <div id="mia-widget-messages" class="mia-messages-scroll flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
      </div>

      <!-- Input -->
      <div class="border-t border-slate-200 bg-white p-3 flex-shrink-0">
        <p class="text-[10px] text-slate-400 text-center mb-2">
          ❗ No realizamos diagnósticos ni prescripciones.
        </p>
        <form id="mia-widget-form" class="flex gap-2">
          <input
            type="text"
            id="mia-widget-input"
            class="mia-input-ring flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-sm placeholder-slate-400"
            placeholder="Escribe tu consulta..."
            maxlength="2000"
            autocomplete="off"
          />
          <button
            type="submit"
            id="mia-widget-send"
            class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  `;
}

function bindWidgetEvents() {
  // Toggle button
  document.getElementById('mia-widget-toggle')?.addEventListener('click', toggleWidget);
  document.getElementById('mia-widget-minimize')?.addEventListener('click', toggleWidget);

  // Form submit
  const form = document.getElementById('mia-widget-form');
  form?.addEventListener('submit', handleWidgetSubmit);

  // Enter key
  const input = document.getElementById('mia-widget-input');
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form?.dispatchEvent(new Event('submit'));
    }
  });
}

function toggleWidget() {
  isOpen = !isOpen;
  const panel = document.getElementById('mia-widget-panel');
  const iconOpen = document.getElementById('mia-widget-icon-open');
  const iconClose = document.getElementById('mia-widget-icon-close');

  if (isOpen) {
    panel?.classList.remove('hidden');
    iconOpen?.classList.add('hidden');
    iconClose?.classList.remove('hidden');

    // Load welcome on first open
    if (messages.length === 0) {
      loadWidgetWelcome();
    }

    // Focus input
    setTimeout(() => {
      document.getElementById('mia-widget-input')?.focus();
    }, 100);
  } else {
    panel?.classList.add('hidden');
    iconOpen?.classList.remove('hidden');
    iconClose?.classList.add('hidden');
  }
}

async function loadWidgetWelcome() {
  try {
    const result = await getWelcome();
    if (result.success) {
      addWidgetMessage('assistant', result.data.message);
    }
  } catch (_) {
    addWidgetMessage(
      'assistant',
      '¡Hola! 👋 Soy **MIA**, tu asistente veterinario.\n\n¿En qué puedo ayudarte?'
    );
  }
}

async function handleWidgetSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('mia-widget-input');
  const message = input?.value.trim();
  if (!message || isLoading) return;

  input.value = '';
  addWidgetMessage('user', message);
  showWidgetTyping();
  setWidgetLoading(true);

  try {
    const productContext = getProductContext();
    const result = await sendMessage({
      sessionId,
      message,
      conversationId,
      productContext,
    });

    hideWidgetTyping();

    if (result.success) {
      const data = result.data;
      conversationId = data.conversationId;
      addWidgetMessage('assistant', data.message, {
        responseType: data.responseType,
        products: data.products,
        clinics: data.clinics,
      });
    }
  } catch (error) {
    hideWidgetTyping();
    addWidgetMessage('assistant', 'Disculpa, ha ocurrido un error. Inténtalo de nuevo.');
  } finally {
    setWidgetLoading(false);
    input?.focus();
  }
}

function addWidgetMessage(role, content, options = {}) {
  const { responseType, products, clinics } = options;
  messages.push({ role, content });

  const container = document.getElementById('mia-widget-messages');
  if (!container) return;

  const isEmergency = responseType === 'emergency_warning';

  let html;
  if (role === 'user') {
    html = `
      <div class="flex justify-end mia-message-enter">
        <div class="bg-teal-600 text-white rounded-2xl rounded-br-md px-3 py-2 max-w-[80%] shadow-sm">
          <p class="text-sm">${escapeHtml(content)}</p>
        </div>
      </div>`;
  } else {
    const parsed = marked.parse(content);
    const productHTML = products?.length > 0 ? renderProductCards(products) : '';
    const clinicHTML = clinics?.length > 0 ? renderClinicCards(clinics) : '';

    html = `
      <div class="flex justify-start gap-2 mia-message-enter ${isEmergency ? 'mia-emergency-pulse' : ''}">
        <div class="${isEmergency ? 'bg-red-100' : 'bg-teal-100'} w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
          <span class="text-xs">${isEmergency ? '🚨' : '🐾'}</span>
        </div>
        <div class="${isEmergency ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200'} border rounded-2xl rounded-bl-md px-3 py-2 max-w-[80%] shadow-sm">
          <div class="mia-markdown-content text-sm text-slate-700">${parsed}</div>
          ${productHTML}
          ${clinicHTML}
        </div>
      </div>`;
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  container.appendChild(wrapper.firstElementChild);
  container.scrollTop = container.scrollHeight;
}

function showWidgetTyping() {
  const container = document.getElementById('mia-widget-messages');
  if (!container) return;
  const el = document.createElement('div');
  el.id = 'mia-widget-typing';
  el.innerHTML = `
    <div class="flex justify-start gap-2 mia-message-enter">
      <div class="bg-teal-100 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
        <span class="text-xs">🐾</span>
      </div>
      <div class="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3 py-2 shadow-sm">
        <div class="flex gap-1 items-center h-4">
          <div class="mia-typing-dot w-1.5 h-1.5 bg-teal-400 rounded-full"></div>
          <div class="mia-typing-dot w-1.5 h-1.5 bg-teal-400 rounded-full"></div>
          <div class="mia-typing-dot w-1.5 h-1.5 bg-teal-400 rounded-full"></div>
        </div>
      </div>
    </div>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function hideWidgetTyping() {
  document.getElementById('mia-widget-typing')?.remove();
}

function setWidgetLoading(loading) {
  isLoading = loading;
  const btn = document.getElementById('mia-widget-send');
  const input = document.getElementById('mia-widget-input');
  if (btn) btn.disabled = loading;
  if (input) input.disabled = loading;
}
