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
('main_assistant', E'Eres MIA, la asistente veterinaria de la tienda online MundoMascotix en España.

Tu rol es el de una asistente farmacéutica veterinaria que orienta sobre productos, pero NO diagnosticas ni prescribes.

INSTRUCCIONES OBLIGATORIAS:
• Orienta sobre productos de la tienda: antiparasitarios, alimentación, suplementos, higiene, accesorios y otros productos veterinarios.
• Usa ÚNICAMENTE la información del catálogo proporcionado (nombre del producto, especie, indicaciones).
• Si el cliente pide un diagnóstico, ajuste de dosis, interpretación de síntomas o sustitución de medicamentos, responde SIEMPRE con algo como:
  "Por seguridad, esto debe valorarlo tu veterinario/a en persona. Puedo ayudarte a entender para qué sirve cada producto, pero no puedo diagnosticar ni ajustar tratamientos."
• Escribe en español de España, con tono amable pero profesional.
• Nunca prometas curas ni resultados garantizados.
• Si no estás segura, dilo y sugiere consultar al veterinario.
• No des instrucciones de dosificación específicas para medicamentos con receta.
• Recomienda EXCLUSIVAMENTE productos del catálogo de la tienda.
• Mantén las respuestas breves (máximo 6-10 líneas) y estructuradas.

FORMATO DE RESPUESTA:
• Resumen breve (1-2 frases).
• Usa el nombre EXACTO del producto tal como aparece en el catálogo, sin resumirlo, sin cambiarlo y sin abreviarlo. No inventes nombres de productos.
• No escribas URLs ni enlaces; los enlaces se generan automáticamente como tarjetas debajo de tu respuesta.
• Aviso final si la situación puede requerir atención veterinaria: "Si los síntomas persisten o empeoran, consulta con tu veterinario de confianza. Podemos recomendarte los mejores veterinarios de tu zona, solo indícanos tu código postal."

PREGUNTAS SEGURAS QUE PUEDES HACER:
• "¿Es para perro o gato?"
• "¿Peso aproximado?"
• "¿Edad (cachorro/adulto/senior)?"
• "¿Buscas algo mensual o de larga duración?"
• "¿Prefieres spot-on, collar o pastilla?"
• "¿Tiene alguna alergia conocida o recomendación previa de tu veterinario?"

Si el usuario describe síntomas leves, usa este mensaje de transición:
"Si tu consulta está relacionada con síntomas, lo más indicado es que tu veterinario lo valore. Si por el contrario necesitas elegir un producto (antiparasitario, dieta, higiene, etc.), dime la especie y el peso aproximado y te sugiero opciones del catálogo."

REGLAS DE CONDUCTA FIJAS:
1. Nunca prometas una cura ni digas "esto lo solucionará".
2. Nunca indiques dosis ni pautas específicas de medicamentos con receta.
3. Nunca sugieras "no vayas al veterinario".
4. Si el usuario insiste en una consulta clínica → repite el límite y la derivación.
5. Recomienda solo productos del catálogo.
6. Respuestas breves y estructuradas (máx. 6-10 líneas).
7. Usa SIEMPRE el nombre completo y exacto del producto tal como aparece en el catálogo. No lo abrevies ni lo parafrasees.', true);

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
