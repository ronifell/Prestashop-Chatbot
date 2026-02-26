/**
 * Template Response Service
 * Returns predefined responses for different safety scenarios.
 * All responses are in Spanish (Spain).
 */

const TEMPLATES = {
  // 3.1 EMERGENCY (red flag detected)
  emergency_warning: {
    type: 'emergency_warning',
    message: `🚨 **Atención urgente**

Según lo que describes, esto podría ser una **emergencia veterinaria**. Este chat no puede atender emergencias ni realizar valoraciones clínicas.

**Te recomiendo acudir a tu veterinario o a un servicio de urgencias veterinarias de forma inmediata.**

Podemos recomendarte los mejores veterinarios de tu zona. Solo indícanos tu código postal.`,
  },

  // 3.2 REFER TO VET (non-urgent symptoms)
  vet_referral: {
    type: 'vet_referral',
    message: `Por seguridad, lo que describes requiere valoración de un veterinario, ya que aquí no puedo diagnosticar ni recomendar tratamientos.

Si quieres, puedo ayudarte a elegir productos de apoyo (por ejemplo, dieta digestiva, productos de higiene, etc.) solo si tu veterinario lo ha recomendado o si me dices qué producto estabas mirando.

También podemos recomendarte los mejores veterinarios de tu zona. Solo indícanos tu código postal.`,
  },

  // 3.3 LIMIT (requesting diagnosis/treatment/dosage/prescription)
  medical_limit: {
    type: 'medical_limit',
    message: `Entiendo tu preocupación. No puedo diagnosticar, prescribir ni ajustar dosis/tratamientos.
Lo mejor es que tu veterinario lo valore.

Si me dices el producto que estás valorando (o el peso/especie), puedo orientarte sobre las diferencias entre opciones y su uso general según la ficha.

También podemos recomendarte los mejores veterinarios de tu zona. Solo indícanos tu código postal.`,
  },

  // 3.4 PRESCRIPTION MEDICATIONS
  rx_limit: {
    type: 'rx_limit',
    message: `Para medicamentos que requieren receta veterinaria, la indicación y la dosis deben venir de un veterinario.

Podemos recomendarte los mejores veterinarios de tu zona. Solo indícanos tu código postal.`,
  },

  // Welcome message
  welcome: {
    type: 'welcome',
    message: `¡Hola! 👋 Soy **MIA**, tu asistente veterinario en MundoMascotix.

Te ayudo a elegir el mejor producto para tu mascota. Pregúntame sobre alimentación, antiparasitarios, higiene y más.

¿En qué puedo ayudarte?`,
  },

  // Transition message for mild symptoms
  symptom_transition: {
    type: 'symptom_transition',
    message: `Si tu consulta está relacionada con síntomas, lo más indicado es que tu veterinario lo valore.

Si por el contrario necesitas elegir un producto (antiparasitario, dieta, higiene, etc.), dime la especie y el peso aproximado y te sugiero opciones del catálogo.`,
  },
};

/**
 * Get a template response by type
 * @param {string} templateType - One of: emergency_warning, vet_referral, medical_limit, rx_limit, welcome, symptom_transition
 * @returns {Object} - { type, message }
 */
export function getTemplate(templateType) {
  return TEMPLATES[templateType] || null;
}

/**
 * Get the welcome message
 */
export function getWelcomeMessage() {
  return TEMPLATES.welcome;
}

/**
 * Get all available template types
 */
export function getTemplateTypes() {
  return Object.keys(TEMPLATES);
}

export default TEMPLATES;
