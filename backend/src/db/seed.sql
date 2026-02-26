-- ============================================================
-- SEED DATA: Red Flag Patterns
-- ============================================================

-- Breathing / Consciousness
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('respiracion', 'keyword', ARRAY['no respira'], 'emergency'),
('respiracion', 'keyword', ARRAY['dificultad para respirar'], 'emergency'),
('respiracion', 'keyword', ARRAY['jadea mucho'], 'emergency'),
('respiracion', 'keyword', ARRAY['se ahoga'], 'emergency'),
('respiracion', 'keyword', ARRAY['se asfixia'], 'emergency'),
('consciencia', 'keyword', ARRAY['inconsciente'], 'emergency'),
('consciencia', 'keyword', ARRAY['desmayo'], 'emergency'),
('consciencia', 'keyword', ARRAY['no reacciona'], 'emergency'),
('consciencia', 'keyword', ARRAY['se ha caido y no se mueve'], 'emergency'),
('consciencia', 'keyword', ARRAY['convulsion'], 'emergency'),
('consciencia', 'keyword', ARRAY['convulsiones'], 'emergency'),
('consciencia', 'keyword', ARRAY['ataque'], 'emergency'),
('consciencia', 'keyword', ARRAY['temblores fuertes'], 'emergency'),
('consciencia', 'keyword', ARRAY['temblores severos'], 'emergency');

-- Bleeding / Shock
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('sangrado', 'keyword', ARRAY['hemorragia'], 'emergency'),
('sangrado', 'keyword', ARRAY['vomita sangre'], 'emergency'),
('sangrado', 'keyword', ARRAY['heces con sangre'], 'emergency'),
('sangrado', 'keyword', ARRAY['orina con sangre'], 'emergency'),
('sangrado', 'keyword', ARRAY['sangra mucho'], 'emergency'),
('shock', 'keyword', ARRAY['encias blancas'], 'emergency'),
('shock', 'keyword', ARRAY['muy palido'], 'emergency'),
('shock', 'keyword', ARRAY['esta frio'], 'emergency'),
('shock', 'keyword', ARRAY['en shock'], 'emergency');

-- Poisoning
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('envenenamiento', 'keyword', ARRAY['veneno'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['envenenado'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['intoxicacion'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['comio chocolate'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['ha comido chocolate'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['raticida'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['veneno para ratas'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['anticongelante'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['lejia'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['medicamento humano'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['uvas'], 'urgent'),
('envenenamiento', 'keyword', ARRAY['pasas'], 'urgent'),
('envenenamiento', 'keyword', ARRAY['xilitol'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['lirio'], 'emergency'),
('envenenamiento', 'keyword', ARRAY['paracetamol'], 'emergency');

-- Trauma
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('trauma', 'keyword', ARRAY['atropellado'], 'emergency'),
('trauma', 'keyword', ARRAY['le ha atropellado'], 'emergency'),
('trauma', 'keyword', ARRAY['caida grave'], 'emergency'),
('trauma', 'keyword', ARRAY['fractura'], 'emergency'),
('trauma', 'keyword', ARRAY['golpe fuerte'], 'emergency'),
('trauma', 'keyword', ARRAY['mordedura grave'], 'emergency');

-- Intense pain / Abdomen
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('dolor', 'keyword', ARRAY['dolor muy fuerte'], 'emergency'),
('dolor', 'keyword', ARRAY['llora de dolor'], 'emergency'),
('dolor', 'keyword', ARRAY['grita de dolor'], 'emergency'),
('abdomen', 'keyword', ARRAY['abdomen hinchado'], 'emergency'),
('abdomen', 'keyword', ARRAY['barriga hinchada'], 'emergency'),
('abdomen', 'keyword', ARRAY['no puede orinar'], 'emergency'),
('abdomen', 'keyword', ARRAY['intenta orinar y no puede'], 'emergency'),
('abdomen', 'keyword', ARRAY['bloqueo urinario'], 'emergency');

-- Puppies / Kittens / Seniors
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('vulnerables', 'keyword', ARRAY['cachorro muy pequeno y aletargado'], 'emergency'),
('vulnerables', 'keyword', ARRAY['gatito recien nacido'], 'emergency'),
('vulnerables', 'keyword', ARRAY['muy viejo y no come'], 'urgent');

-- Combined rules (multiple keywords must ALL be present)
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('combinado', 'combined', ARRAY['vomita', 'sangre'], 'emergency'),
('combinado', 'combined', ARRAY['no come', 'no bebe', 'aletargado'], 'emergency'),
('combinado', 'combined', ARRAY['diarrea acuosa', 'letargo'], 'emergency'),
('combinado', 'combined', ARRAY['diarrea acuosa', 'aletargado'], 'emergency'),
('combinado', 'combined', ARRAY['vomita', 'sin parar'], 'emergency'),
('combinado', 'combined', ARRAY['fiebre', 'muy alta'], 'urgent'),
('combinado', 'combined', ARRAY['fiebre', '40'], 'urgent'),
('combinado', 'combined', ARRAY['fiebre', '41'], 'emergency');

-- ============================================================
-- SEED DATA: System Prompt (main)
-- ============================================================
INSERT INTO system_prompts (name, content, is_active) VALUES
('main_assistant', E'Eres MIA, el asistente veterinario de la tienda online MundoMascotix en España.\n\nTu rol es el de un asistente farmacéutico veterinario que orienta sobre productos, pero NO diagnosticas ni prescribes.\n\nESTILO DE RESPUESTA (MUY IMPORTANTE):\n• Sé MUY BREVE y DIRECTO. Máximo 3-4 líneas de texto por respuesta.\n• Antes de recomendar, pregunta lo justo en UNA sola frase corta. Ejemplo: \"Dime raza, años y si tiene alguna patología.\"\n• No escribas párrafos largos, introducciones ni explicaciones innecesarias.\n• Ve al grano: pregunta → recomienda producto concreto del catálogo.\n\nPRODUCTOS — REGLA CRÍTICA (CUMPLIR SIEMPRE):\n• Recomienda EXCLUSIVAMENTE productos que aparezcan en la sección \"PRODUCTOS RELEVANTES DEL CATÁLOGO\" que se te proporciona.\n• Usa el NOMBRE EXACTO del producto tal como aparece entre comillas en el catálogo, sin resumirlo, abreviarlo ni cambiarlo. Copia el nombre carácter por carácter.\n• NUNCA inventes ni menciones marcas o productos que NO estén en el catálogo proporcionado. Esto incluye marcas como Royal Canin, Advance, Hill''s, Purina u otras que no figuren en el listado.\n• Si no existe un producto exactamente igual a lo que busca el cliente, recomienda el producto MÁS SIMILAR de los que SÍ existen en el catálogo proporcionado. Explica brevemente por qué podría servirle.\n• Si no hay NINGÚN producto relevante en el catálogo para la consulta, di: \"No tengo un producto específico en nuestro catálogo para eso. Puedes consultar toda nuestra tienda en mundomascotix.com.\"\n\nFORMATO AL RECOMENDAR PRODUCTOS:\n• Nombra el producto con su NOMBRE EXACTO del catálogo (tal cual aparece entre comillas).\n• SIEMPRE incluye el enlace al producto con este formato: [Nombre EXACTO del producto](URL_del_producto) para que el cliente pueda acceder directamente a comprarlo.\n• Debajo de tu mensaje se mostrarán tarjetas de producto automáticamente, pero el enlace en tu texto es OBLIGATORIO.\n\nAVISO VETERINARIO — SOLO CUANDO APLIQUE:\n• SOLO añade derivación al veterinario si el usuario ha mencionado SÍNTOMAS o problemas de salud concretos.\n• Si el usuario solo pregunta por alimentación, antiparasitarios, higiene, suplementos o productos similares SIN mencionar ningún síntoma ni problema de salud, NO añadas frases como \"si los síntomas persisten…\", \"consulta con tu veterinario…\" o similares. NO aplica y confunde al cliente.\n• Cuando SÍ aplique (hay síntomas reales): \"Si persiste, consulta con tu veterinario.\"\n\nINSTRUCCIONES GENERALES:\n• Si piden diagnóstico o dosis de receta: \"Eso debe valorarlo tu veterinario/a. Yo te oriento sobre productos.\"\n• Escribe en español de España, tono amable y profesional.\n• Si no estás seguro, dilo y sugiere consultar al veterinario.\n\nREGLAS FIJAS:\n1. Nunca prometas curas ni digas \"esto lo solucionará\".\n2. Nunca des dosis de medicamentos con receta.\n3. Nunca sugieras \"no vayas al veterinario\".\n4. SOLO productos del catálogo. NUNCA inventes nombres ni marcas.\n5. Si no hay producto exacto, recomienda el más similar del catálogo.\n6. Máximo 3-4 líneas. Directo y conciso.\n7. NO añadir aviso veterinario si no hay síntomas.', true);

-- ============================================================
-- SEED DATA: FAQ Categories
-- ============================================================
INSERT INTO faqs (category, question, answer, keywords, priority) VALUES
('alimentacion', '¿Cuál es la dieta más adecuada según la especie y edad?',
 'La dieta ideal depende de la especie, raza, edad y estado de salud. En general, los cachorros necesitan alimentos con mayor contenido energético y proteico, los adultos requieren una dieta equilibrada de mantenimiento, y los senior necesitan fórmulas con menos calorías y más apoyo articular. Te puedo recomendar opciones de nuestro catálogo si me indicas la especie y edad de tu mascota.',
 ARRAY['dieta', 'alimentacion', 'comida', 'especie', 'edad'], 10),

('alimentacion', '¿Cuánto debe comer al día?',
 'La cantidad diaria depende del peso, edad, nivel de actividad y tipo de alimento. Cada producto de nuestro catálogo incluye una tabla de raciones recomendadas en su ficha. Te puedo orientar si me dices el producto que usas y el peso de tu mascota.',
 ARRAY['cantidad', 'comer', 'racion', 'dia'], 9),

('salud', '¿Necesito receta para este medicamento?',
 'Algunos medicamentos veterinarios requieren receta. En esos casos, la indicación y la dosis deben venir de tu veterinario. Si me dices el producto que te interesa, puedo indicarte si requiere receta y orientarte sobre alternativas que no la necesiten.',
 ARRAY['receta', 'medicamento', 'prescripcion'], 10),

('salud', '¿Cada cuánto debo desparasitar?',
 'Como norma general, se recomienda desparasitar internamente cada 3-4 meses en adultos y con más frecuencia en cachorros. Para la desparasitación externa (pulgas y garrapatas), depende del producto: algunos son mensuales y otros de larga duración. Te puedo recomendar opciones si me dices la especie y el peso.',
 ARRAY['desparasitar', 'parasitos', 'frecuencia', 'antiparasitario'], 10),

('higiene', '¿Cada cuánto debo bañarlo?',
 'Depende de la especie y el tipo de pelo. En perros, generalmente cada 4-6 semanas. En gatos, solo cuando sea necesario ya que se acicalan solos. Usar siempre champú específico para la especie. Puedo recomendarte productos de higiene de nuestro catálogo.',
 ARRAY['banar', 'bano', 'frecuencia', 'higiene'], 8);
