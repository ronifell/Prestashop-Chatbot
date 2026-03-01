/**
 * Intent Detection Service
 * Detects user intent based on the MIA v2.0 dictionary
 * Maps user queries to product categories and search strategies
 */

import { normalizeText, containsKeyword } from '../utils/textNormalizer.js';
import logger from '../utils/logger.js';

// Intent dictionary based on Fix.md specifications
const INTENT_DICTIONARY = {
  version: "mia-v2.0",
  language: "es-ES",
  normalization: {
    strip_accents: true,
    case_insensitive: true,
    whitespace_collapse: true,
    category_aliases: {
      "DERMATOLOGIA": "DERMATOLOGÍA",
      "DERMATOLOGÍA": "DERMATOLOGÍA",
      "OTICO": "ÓTICO",
      "ÓTICO": "ÓTICO",
      "CONDOPROTECTOR/ARTICULAR": "CONDROPROTECTOR/ARTICULAR",
      "CONDROPROTECTOR ARTICULAR": "CONDROPROTECTOR/ARTICULAR",
      "DIETA VETERINARIA": "DIETA VETERINARIA",
      "GASTRO INTESTINAL": "GASTROINTESTINAL",
      "GASTROINTESTINAL": "GASTROINTESTINAL",
      "BUCO DENTAL": "BUCODENTAL",
      "BUCODENTAL": "BUCODENTAL"
    },
    token_aliases: {
      "condoprotector": "condroprotector",
      "condro": "condroprotector",
      "artrosis": "articulaciones",
      "movilidad": "articulaciones",
      "diabetico": "diabetes",
      "diabético": "diabetes",
      "diabetica": "diabetes",
      "diabética": "diabetes",
      "renal": "rinon",
      "riñon": "rinon",
      "riñones": "rinon",
      "gastro": "gastrointestinal",
      "intestinal": "gastrointestinal",
      "diarrea": "gastrointestinal",
      "vomitos": "gastrointestinal",
      "vómitos": "gastrointestinal",
      "hipoalergenico": "hipoalergenico",
      "hipoalergénico": "hipoalergenico",
      "hidrolizado": "hidrolizado",
      "ultrahypo": "ultrahypo",
      "toallitas": "higiene",
      "oidos": "otico",
      "oídos": "otico",
      "otitis": "otico",
      "dental": "bucodental",
      "sarro": "bucodental",
      "malaliento": "halitosis",
      "aliento": "halitosis"
    }
  },
  intents: [
    {
      id: "SUPPORT_SHOP",
      priority: 100,
      triggers_any: [
        "envio", "envíos", "entrega", "devolucion", "devolución", "cambio",
        "pago", "factura", "pedido", "seguimiento", "reembolso",
        "tarjeta", "bizum", "transferencia"
      ],
      category_candidates: [],
      search_strategy: ["faq", "policies"]
    },
    {
      id: "JOINTS_CONDROPROTECTOR",
      priority: 90,
      triggers_any: [
        "condroprotector", "articulaciones", "artrosis", "movilidad",
        "cojera", "cartilago", "cartílago", "glucosamina", "condroitina",
        "msm", "seraquin", "condrovet", "cosequin"
      ],
      category_candidates: [
        ["CONDROPROTECTOR/ARTICULAR"],
        ["SALUD", "CONDROPROTECTOR/ARTICULAR"],
        ["SUPLEMENTOS", "CONDROPROTECTOR/ARTICULAR"]
      ],
      search_strategy: ["categories_first", "name_with_synonyms"],
      name_synonyms_any: ["condro", "joint", "mobility", "glucos", "chondro", "articular"]
    },
    {
      id: "DIET_RENAL",
      priority: 90,
      triggers_any: [
        "renal", "renales", "rinon", "riñon", "riñones", "insuficiencia renal", "kidney",
        "uremia", "uremico", "porus one", "porus", "nefro", "renal care"
      ],
      category_candidates: [
        ["DIETA VETERINARIA"],
        ["SALUD", "RENAL"],
        ["RENAL"]
      ],
      category_filters: {
        "DIETA VETERINARIA": {
          must_match_name_any: ["renal", "kidney", "renal care"]
        }
      },
      search_strategy: ["category_then_name"],
      name_synonyms_any: ["renal", "kidney", "nefro", "urinario", "uremia"]
    },
    {
      id: "DIET_DIABETES",
      priority: 85,
      triggers_any: [
        "diabetes", "diabetico", "diabético", "insulina", "glucosa",
        "diabetic", "glycemic", "glucemico", "glucémico"
      ],
      category_candidates: [
        ["DIETA VETERINARIA"]
      ],
      category_filters: {
        "DIETA VETERINARIA": {
          must_match_name_any: ["diabet", "diabetes", "diabetic"]
        }
      },
      search_strategy: ["category_then_name"],
      name_synonyms_any: ["diabet", "diabetes", "diabetic"]
    },
    {
      id: "DIET_HYPOALLERGENIC",
      priority: 85,
      triggers_any: [
        "alergia", "alergico", "alérgico", "hipoalergenico", "hipoalergénico",
        "ultrahypo", "hypoallergenic", "hidrolizado", "hidrolizada",
        "intolerancia", "dieta de eliminacion", "dieta de eliminación", "prurito por comida"
      ],
      category_candidates: [
        ["DIETA VETERINARIA"],
        ["SALUD", "DERMATOLOGÍA"],
        ["DERMATOLOGÍA"]
      ],
      category_filters: {
        "DIETA VETERINARIA": {
          should_match_name_any: ["hypo", "ultra", "allerg", "hidrol", "anallergenic"]
        }
      },
      search_strategy: ["category_then_name"],
      name_synonyms_any: ["hypo", "ultra", "allerg", "hidrol", "anallergenic", "z/d", "ha"]
    },
    {
      id: "GI_GASTROINTESTINAL",
      priority: 80,
      triggers_any: [
        "diarrea", "vomito", "vómito", "vomitos", "vómitos", "gastro",
        "gastrointestinal", "intestino", "heces blandas", "flora intestinal",
        "probiotico", "probiótico", "prebiotico", "prebiótico", "fortiflora",
        "forti flora", "intestinal", "colitis"
      ],
      category_candidates: [
        ["GASTROINTESTINAL"],
        ["DIETA VETERINARIA"],
        ["SALUD", "GASTROINTESTINAL"]
      ],
      category_filters: {
        "DIETA VETERINARIA": {
          should_match_name_any: ["gastro", "intestinal", "gi", "digest"]
        }
      },
      search_strategy: ["categories_first", "name_with_synonyms"],
      name_synonyms_any: ["fortiflora", "probiotic", "prebiotic", "intestinal", "gastro", "digest"],
      red_flags_any: [
        "sangre", "heces negras", "vomitos repetidos", "vómitos repetidos",
        "apatia", "apatía", "no come", "no bebe", "deshidrat", "cachorro muy pequeño", "gatito"
      ]
    },
    {
      id: "DENTAL_HALITOSIS",
      priority: 75,
      triggers_any: [
        "mal aliento", "halitosis", "sarro", "dientes", "pasta de dientes",
        "cepillo", "higiene dental", "dental", "gingivitis"
      ],
      category_candidates: [
        ["BUCODENTAL"],
        ["HIGIENE", "BUCODENTAL"]
      ],
      search_strategy: ["categories_first", "name_with_synonyms"],
      name_synonyms_any: ["dental", "tooth", "pasta", "cepillo", "sarro", "aliento"]
    },
    {
      id: "EAR_OTIC",
      priority: 75,
      triggers_any: [
        "oido", "oído", "oidos", "oídos", "otitis", "limpiar oidos", "limpiar oídos",
        "oreja", "orejas", "cera", "mal olor oido", "gotas oticas", "gotas óticas"
      ],
      category_candidates: [
        ["ÓTICO"],
        ["HIGIENE", "ÓTICO"]
      ],
      search_strategy: ["categories_first", "name_with_synonyms"],
      name_synonyms_any: ["otico", "otitis", "ear", "oido", "oreja"],
      red_flags_any: ["dolor intenso", "pus", "fiebre", "cabeza ladeada", "equilibrio"]
    },
    {
      id: "PARASITES_EXTERNAL",
      priority: 70,
      triggers_any: [
        "antiparasitario", "pulgas", "garrapatas", "mosquitos", "leishmania",
        "pipeta", "collar", "spray antiparasitario", "repelente", "repelente mosquitos"
      ],
      category_candidates: [
        ["ANTIPARASITARIOS"],
        ["HIGIENE", "ANTIPARASITARIOS"]
      ],
      search_strategy: ["categories_first", "name_with_synonyms"],
      name_synonyms_any: ["flea", "tick", "pipeta", "collar", "repel", "mosquito", "leish"]
    }
  ]
};

/**
 * Normalize category name using aliases
 */
function normalizeCategoryName(categoryName) {
  if (!categoryName) return '';
  const normalized = categoryName.toUpperCase().trim();
  return INTENT_DICTIONARY.normalization.category_aliases[normalized] || normalized;
}

/**
 * Normalize token using aliases
 */
function normalizeToken(token) {
  const normalized = normalizeText(token);
  return INTENT_DICTIONARY.normalization.token_aliases[normalized] || normalized;
}

/**
 * Detect intent from user message
 * @param {string} userMessage - User's message
 * @returns {Object} - { intent, categoryCandidates, searchStrategy, nameSynonyms, redFlags }
 */
export function detectIntent(userMessage) {
  const normalized = normalizeText(userMessage);
  const tokens = normalized.split(/\s+/).map(normalizeToken);
  const fullText = tokens.join(' ');

  let bestIntent = null;
  let bestPriority = -1;

  // Check each intent
  for (const intent of INTENT_DICTIONARY.intents) {
    // Check if any trigger matches
    const hasTrigger = intent.triggers_any.some(trigger => {
      const normalizedTrigger = normalizeToken(trigger);
      return fullText.includes(normalizedTrigger) || tokens.includes(normalizedTrigger);
    });

    if (hasTrigger && intent.priority > bestPriority) {
      bestIntent = intent;
      bestPriority = intent.priority;
    }
  }

  // Check for red flags in the message
  const detectedRedFlags = [];
  if (bestIntent && bestIntent.red_flags_any) {
    for (const redFlag of bestIntent.red_flags_any) {
      if (containsKeyword(normalized, redFlag)) {
        detectedRedFlags.push(redFlag);
      }
    }
  }

  // Also check GI red flags globally
  const giIntent = INTENT_DICTIONARY.intents.find(i => i.id === "GI_GASTROINTESTINAL");
  if (giIntent && giIntent.red_flags_any) {
    for (const redFlag of giIntent.red_flags_any) {
      if (containsKeyword(normalized, redFlag) && !detectedRedFlags.includes(redFlag)) {
        detectedRedFlags.push(redFlag);
      }
    }
  }

  if (bestIntent) {
    logger.debug('Intent detected', {
      intent: bestIntent.id,
      priority: bestIntent.priority,
      message: userMessage.substring(0, 100),
      redFlags: detectedRedFlags
    });

    return {
      intent: bestIntent.id,
      categoryCandidates: bestIntent.category_candidates || [],
      categoryFilters: bestIntent.category_filters || {},
      searchStrategy: bestIntent.search_strategy || [],
      nameSynonyms: bestIntent.name_synonyms_any || [],
      redFlags: detectedRedFlags,
      followupQuestions: bestIntent.followup_questions || []
    };
  }

  // Default: no specific intent detected
  return {
    intent: null,
    categoryCandidates: [],
    categoryFilters: {},
    searchStrategy: [],
    nameSynonyms: [],
    redFlags: [],
    followupQuestions: []
  };
}

/**
 * Get normalized category names for search
 */
export function getNormalizedCategoryNames(categoryCandidates) {
  const normalized = [];
  for (const candidatePath of categoryCandidates) {
    for (const cat of candidatePath) {
      const norm = normalizeCategoryName(cat);
      if (norm && !normalized.includes(norm)) {
        normalized.push(norm);
      }
    }
  }
  return normalized;
}

/**
 * Check if message is a support/shop inquiry (not product recommendation)
 */
export function isSupportIntent(userMessage) {
  const result = detectIntent(userMessage);
  return result.intent === "SUPPORT_SHOP";
}

export default {
  detectIntent,
  getNormalizedCategoryNames,
  isSupportIntent
};
