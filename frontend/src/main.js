/**
 * MIA Chatbot - Main Entry Point
 * MundoMascotix Veterinary Assistant
 * 
 * On the homepage: Renders as a hero block (main visible element)
 * On internal/product pages: Renders as a floating widget
 */

import './style.css';
import { initChatHero } from './components/ChatHero.js';
import { initChatWidget } from './components/ChatWidget.js';

// Determine page type and initialize appropriate component
function init() {
  const heroContainer = document.getElementById('mia-chat-hero');

  if (heroContainer) {
    // Homepage: Render hero chat as main block
    initChatHero('mia-chat-hero');
    console.log('🐾 MIA Chat Hero initialized');
  } else {
    // Internal pages: Render floating widget
    initChatWidget();
    console.log('🐾 MIA Chat Widget initialized');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
