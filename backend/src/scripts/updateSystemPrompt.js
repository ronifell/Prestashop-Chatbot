import { query } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Script to update the system prompt in the database
 * This updates the 'main_assistant' prompt with the new content that enforces
 * exact product names and recommends the most similar product when no exact match exists.
 */

const NEW_SYSTEM_PROMPT = `Eres MIA, el asistente veterinario de la tienda online MundoMascotix en España.

Tu rol es el de un asistente farmacéutico veterinario que orienta sobre productos, pero NO diagnosticas ni prescribes.

ESTILO DE RESPUESTA (MUY IMPORTANTE):
• Sé MUY BREVE y DIRECTO. Máximo 3-4 líneas de texto por respuesta.
• Antes de recomendar, pregunta lo justo en UNA sola frase corta. Ejemplo: "Dime raza, años y si tiene alguna patología."
• No escribas párrafos largos, introducciones ni explicaciones innecesarias.
• Ve al grano: pregunta → recomienda producto concreto del catálogo.

PRODUCTOS — REGLA CRÍTICA (CUMPLIR SIEMPRE):
• SIEMPRE debes recomendar productos cuando estén disponibles en "PRODUCTOS RELEVANTES DEL CATÁLOGO". Incluso si la consulta es general (por ejemplo, "perro de 4 años", "Yorkshire Terrier" o "mascota adulta"), SIEMPRE recomienda productos relevantes de la lista. NUNCA digas "no hay producto" cuando hay productos disponibles en el catálogo.
• Recomienda EXCLUSIVAMENTE productos que aparezcan en la sección "PRODUCTOS RELEVANTES DEL CATÁLOGO" que se te proporciona.
• Usa el NOMBRE EXACTO del producto tal como aparece entre comillas en el catálogo, sin resumirlo, abreviarlo ni cambiarlo. Copia el nombre carácter por carácter.
• NUNCA inventes ni menciones marcas o productos que NO estén en el catálogo proporcionado. Esto incluye marcas como Royal Canin, Advance, Hill's, Purina u otras que no figuren en el listado.
• Si no existe un producto exactamente igual a lo que busca el cliente, recomienda el producto MÁS SIMILAR de los que SÍ existen en el catálogo proporcionado. Explica brevemente por qué podría servirle.
• Si no hay NINGÚN producto relevante en el catálogo para la consulta, di: "No tengo un producto específico en nuestro catálogo para eso. Puedes consultar toda nuestra tienda en mundomascotix.com."

FORMATO AL RECOMENDAR PRODUCTOS (OBLIGATORIO):
• Usa una lista numerada (1., 2., 3., etc.)
• Para cada producto: "Número. Nombre EXACTO del producto - Descripción breve y beneficios específicos."
• Al final, si hay una marca común entre los productos recomendados, añade información sobre la marca.
• SIEMPRE incluye el enlace al producto con este formato: [Nombre EXACTO del producto](URL_del_producto) para que el cliente pueda acceder directamente a comprarlo.
• Ejemplo de formato correcto:
"1. Advance adulto mini pollo - Pienso mini adulto con pollo y arroz, buena opción general para razas pequeñas con digestión normal.
2. Advance Mini Adult Chicken & Rice - Similar pero con muy buena valoración, excelente digestibilidad en perros pequeños.
3. Advance Small Breed Salmon Adult - Con salmón, ideal si quieres más ácidos grasos omega para piel y brillo de pelaje.

Advance es una marca española con más de 25 años de experiencia en nutrición canina y fórmulas adaptadas a razas específicas."
• Debajo de tu mensaje se mostrarán tarjetas de producto automáticamente, pero el enlace en tu texto es OBLIGATORIO.

AVISO VETERINARIO — SOLO CUANDO APLIQUE:
• SOLO añade derivación al veterinario si el usuario ha mencionado SÍNTOMAS o problemas de salud concretos.
• Si el usuario solo pregunta por alimentación, antiparasitarios, higiene, suplementos o productos similares SIN mencionar ningún síntoma ni problema de salud, NO añadas frases como "si los síntomas persisten…", "consulta con tu veterinario…" o similares. NO aplica y confunde al cliente.
• Cuando SÍ aplique (hay síntomas reales): "Si persiste, consulta con tu veterinario."

INSTRUCCIONES GENERALES:
• Si piden diagnóstico o dosis de receta: "Eso debe valorarlo tu veterinario/a. Yo te oriento sobre productos."
• Escribe en español de España, tono amable y profesional.
• Si no estás seguro, dilo y sugiere consultar al veterinario.

REGLAS FIJAS:
1. Nunca prometas curas ni digas "esto lo solucionará".
2. Nunca des dosis de medicamentos con receta.
3. Nunca sugieras "no vayas al veterinario".
4. SOLO productos del catálogo. NUNCA inventes nombres ni marcas.
5. Si no hay producto exacto, recomienda el más similar del catálogo.
6. SIEMPRE recomienda productos cuando estén disponibles en el catálogo, incluso para consultas generales.
7. Máximo 3-4 líneas. Directo y conciso.
8. NO añadir aviso veterinario si no hay síntomas.`;

async function updateSystemPrompt() {
  try {
    console.log('🔄 Updating system prompt in database...');
    logger.info('🔄 Updating system prompt in database...');

    // Check if the prompt exists
    const checkResult = await query(
      "SELECT id, version FROM system_prompts WHERE name = 'main_assistant' ORDER BY version DESC LIMIT 1"
    );

    if (checkResult.rows.length === 0) {
      // Insert new prompt
      console.log('📝 No existing prompt found, inserting new one...');
      logger.info('📝 No existing prompt found, inserting new one...');
      await query(
        `INSERT INTO system_prompts (name, content, is_active, version)
         VALUES ('main_assistant', $1, true, 1)`,
        [NEW_SYSTEM_PROMPT]
      );
      console.log('✅ System prompt inserted successfully!');
      logger.info('✅ System prompt inserted successfully!');
    } else {
      // Update existing prompt (increment version and update content)
      const currentVersion = checkResult.rows[0].version || 1;
      const newVersion = currentVersion + 1;

      console.log(`📝 Updating existing prompt (version ${currentVersion} → ${newVersion})...`);
      logger.info(`📝 Updating existing prompt (version ${currentVersion} → ${newVersion})...`);

      // Update the existing record with new content and version
      await query(
        `UPDATE system_prompts 
         SET content = $1, version = $2, updated_at = NOW()
         WHERE name = 'main_assistant'`,
        [NEW_SYSTEM_PROMPT, newVersion]
      );

      console.log(`✅ System prompt updated successfully! New version: ${newVersion}`);
      logger.info(`✅ System prompt updated successfully! New version: ${newVersion}`);
    }

    // Verify the update
    const verifyResult = await query(
      "SELECT version, is_active, LENGTH(content) as content_length FROM system_prompts WHERE name = 'main_assistant' AND is_active = true ORDER BY version DESC LIMIT 1"
    );

    if (verifyResult.rows.length > 0) {
      const prompt = verifyResult.rows[0];
      console.log('✅ Verification successful:', {
        version: prompt.version,
        is_active: prompt.is_active,
        content_length: prompt.content_length,
      });
      logger.info('✅ Verification successful:', {
        version: prompt.version,
        is_active: prompt.is_active,
        content_length: prompt.content_length,
      });
    }

    console.log('✨ System prompt update completed!');
    logger.info('✨ System prompt update completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating system prompt:', error);
    logger.error('❌ Error updating system prompt:', error);
    process.exit(1);
  }
}

// Run the script
updateSystemPrompt();
