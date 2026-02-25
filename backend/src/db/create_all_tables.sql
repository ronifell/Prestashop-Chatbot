-- ============================================================
-- MIA Chatbot — Full Database Setup
-- MundoMascotix Veterinary Assistant
--
-- This script creates the database, all tables, indexes,
-- triggers, views, and inserts seed data.
--
-- USAGE:
--   1. Connect to PostgreSQL as a superuser / admin:
--        psql -U postgres
--   2. Create the database (skip if it already exists):
--        CREATE DATABASE mundomascotix_chatbot;
--   3. Connect to the new database:
--        \c mundomascotix_chatbot
--   4. Run this script:
--        \i path/to/create_all_tables.sql
--
-- Or run directly from the command line:
--   psql -U postgres -d mundomascotix_chatbot -f create_all_tables.sql
-- ============================================================

BEGIN;

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Trigram fuzzy text search

-- ============================================================
-- 2. TABLE: products
--    Stores the PrestaShop product catalog.
--    Includes full-text search vector (Spanish) and trigram index.
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id                    SERIAL PRIMARY KEY,
    prestashop_id         VARCHAR(50) UNIQUE,
    code                  VARCHAR(100),
    name                  VARCHAR(500) NOT NULL,
    brand                 VARCHAR(200),
    category              VARCHAR(300),
    subcategory           VARCHAR(300),
    species               VARCHAR(200),
    price                 DECIMAL(10, 2),
    product_url           TEXT,
    add_to_cart_url       TEXT,
    image_url             TEXT,
    description           TEXT,
    indications           TEXT,
    active_ingredients    TEXT,
    requires_prescription BOOLEAN DEFAULT FALSE,
    is_active             BOOLEAN DEFAULT TRUE,
    search_vector         TSVECTOR,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_search    ON products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_species   ON products(species);
CREATE INDEX IF NOT EXISTS idx_products_active    ON products(is_active);

-- Auto-update search_vector on INSERT / UPDATE
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('spanish', COALESCE(NEW.name, '')),               'A') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.category, '')),           'B') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.species, '')),            'B') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.brand, '')),              'C') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.description, '')),        'C') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.indications, '')),        'C') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.active_ingredients, '')), 'D');
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
CREATE TRIGGER trg_products_search_vector
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();

-- ============================================================
-- 3. TABLE: vet_clinics
--    Collaborating veterinary clinics, looked up by postal code.
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_clinics (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(300) NOT NULL,
    address      TEXT,
    city         VARCHAR(200),
    province     VARCHAR(200),
    postal_code  VARCHAR(10) NOT NULL,
    phone        VARCHAR(50),
    email        VARCHAR(200),
    website      TEXT,
    is_emergency BOOLEAN DEFAULT FALSE,
    is_active    BOOLEAN DEFAULT TRUE,
    notes        TEXT,
    created_at   TIMESTAMP DEFAULT NOW(),
    updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vet_clinics_postal ON vet_clinics(postal_code);
CREATE INDEX IF NOT EXISTS idx_vet_clinics_active ON vet_clinics(is_active);

-- ============================================================
-- 4. TABLE: conversations
--    Each chat session between a visitor and MIA.
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      VARCHAR(100) NOT NULL,
    started_at      TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW(),
    message_count   INTEGER DEFAULT 0,
    has_emergency   BOOLEAN DEFAULT FALSE,
    product_context JSONB,
    metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_date    ON conversations(started_at);

-- ============================================================
-- 5. TABLE: messages
--    Individual messages inside a conversation (user + assistant).
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id                   SERIAL PRIMARY KEY,
    conversation_id      UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role                 VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content              TEXT NOT NULL,
    response_type        VARCHAR(50),
    red_flags_detected   TEXT[],
    products_recommended INTEGER[],
    tokens_used          INTEGER,
    processing_time_ms   INTEGER,
    created_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_type         ON messages(response_type);
CREATE INDEX IF NOT EXISTS idx_messages_date         ON messages(created_at);

-- ============================================================
-- 6. TABLE: vademecums
--    PDF vademecum documents with extracted text and chunks.
-- ============================================================
CREATE TABLE IF NOT EXISTS vademecums (
    id             SERIAL PRIMARY KEY,
    filename       VARCHAR(500) NOT NULL,
    original_name  VARCHAR(500),
    content_text   TEXT,
    content_chunks JSONB,
    product_ids    INTEGER[],
    file_hash      VARCHAR(64),
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMP DEFAULT NOW(),
    updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vademecums_active ON vademecums(is_active);

-- ============================================================
-- 7. TABLE: faqs
--    Editable FAQ knowledge base used for chat context.
-- ============================================================
CREATE TABLE IF NOT EXISTS faqs (
    id         SERIAL PRIMARY KEY,
    category   VARCHAR(100) NOT NULL,
    question   TEXT NOT NULL,
    answer     TEXT NOT NULL,
    keywords   TEXT[],
    priority   INTEGER DEFAULT 0,
    is_active  BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_faqs_active   ON faqs(is_active);

-- ============================================================
-- 8. TABLE: red_flag_patterns
--    Configurable emergency keyword/combined patterns.
-- ============================================================
CREATE TABLE IF NOT EXISTS red_flag_patterns (
    id           SERIAL PRIMARY KEY,
    category     VARCHAR(100) NOT NULL,
    pattern_type VARCHAR(20)  NOT NULL CHECK (pattern_type IN ('keyword', 'combined')),
    keywords     TEXT[]       NOT NULL,
    severity     VARCHAR(20)  DEFAULT 'emergency' CHECK (severity IN ('emergency', 'urgent', 'caution')),
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_red_flags_active ON red_flag_patterns(is_active);

-- ============================================================
-- 9. TABLE: system_prompts
--    Versioned system prompts sent to OpenAI.
-- ============================================================
CREATE TABLE IF NOT EXISTS system_prompts (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    content    TEXT NOT NULL,
    is_active  BOOLEAN DEFAULT TRUE,
    version    INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 10. VIEW: chat_stats
--     Daily aggregated chat analytics.
-- ============================================================
CREATE OR REPLACE VIEW chat_stats AS
SELECT
    DATE(m.created_at)                                                  AS chat_date,
    COUNT(DISTINCT m.conversation_id)                                   AS total_conversations,
    COUNT(*) FILTER (WHERE m.role = 'user')                             AS total_user_messages,
    COUNT(*) FILTER (WHERE m.response_type = 'emergency_warning')       AS emergencies,
    COUNT(*) FILTER (WHERE m.response_type = 'vet_referral')            AS vet_referrals,
    COUNT(*) FILTER (WHERE m.response_type = 'medical_limit')           AS medical_limits,
    COUNT(*) FILTER (WHERE m.response_type = 'rx_limit')                AS rx_limits,
    AVG(m.processing_time_ms) FILTER (WHERE m.role = 'assistant')       AS avg_response_time_ms
FROM messages m
GROUP BY DATE(m.created_at)
ORDER BY chat_date DESC;

-- ============================================================
-- 11. SEED DATA: Red Flag Patterns
-- ============================================================

-- Breathing / Consciousness
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('respiracion',  'keyword', ARRAY['no respira'],                    'emergency'),
('respiracion',  'keyword', ARRAY['dificultad para respirar'],      'emergency'),
('respiracion',  'keyword', ARRAY['jadea mucho'],                   'emergency'),
('respiracion',  'keyword', ARRAY['se ahoga'],                      'emergency'),
('respiracion',  'keyword', ARRAY['se asfixia'],                    'emergency'),
('consciencia',  'keyword', ARRAY['inconsciente'],                  'emergency'),
('consciencia',  'keyword', ARRAY['desmayo'],                       'emergency'),
('consciencia',  'keyword', ARRAY['no reacciona'],                  'emergency'),
('consciencia',  'keyword', ARRAY['se ha caido y no se mueve'],     'emergency'),
('consciencia',  'keyword', ARRAY['convulsion'],                    'emergency'),
('consciencia',  'keyword', ARRAY['convulsiones'],                  'emergency'),
('consciencia',  'keyword', ARRAY['ataque'],                        'emergency'),
('consciencia',  'keyword', ARRAY['temblores fuertes'],             'emergency'),
('consciencia',  'keyword', ARRAY['temblores severos'],             'emergency');

-- Bleeding / Shock
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('sangrado', 'keyword', ARRAY['hemorragia'],        'emergency'),
('sangrado', 'keyword', ARRAY['vomita sangre'],     'emergency'),
('sangrado', 'keyword', ARRAY['heces con sangre'],  'emergency'),
('sangrado', 'keyword', ARRAY['orina con sangre'],  'emergency'),
('sangrado', 'keyword', ARRAY['sangra mucho'],       'emergency'),
('shock',    'keyword', ARRAY['encias blancas'],     'emergency'),
('shock',    'keyword', ARRAY['muy palido'],         'emergency'),
('shock',    'keyword', ARRAY['esta frio'],          'emergency'),
('shock',    'keyword', ARRAY['en shock'],           'emergency');

-- Poisoning
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('envenenamiento', 'keyword', ARRAY['veneno'],              'emergency'),
('envenenamiento', 'keyword', ARRAY['envenenado'],           'emergency'),
('envenenamiento', 'keyword', ARRAY['intoxicacion'],         'emergency'),
('envenenamiento', 'keyword', ARRAY['comio chocolate'],      'emergency'),
('envenenamiento', 'keyword', ARRAY['ha comido chocolate'],  'emergency'),
('envenenamiento', 'keyword', ARRAY['raticida'],             'emergency'),
('envenenamiento', 'keyword', ARRAY['veneno para ratas'],    'emergency'),
('envenenamiento', 'keyword', ARRAY['anticongelante'],       'emergency'),
('envenenamiento', 'keyword', ARRAY['lejia'],                'emergency'),
('envenenamiento', 'keyword', ARRAY['medicamento humano'],   'emergency'),
('envenenamiento', 'keyword', ARRAY['uvas'],                 'urgent'),
('envenenamiento', 'keyword', ARRAY['pasas'],                'urgent'),
('envenenamiento', 'keyword', ARRAY['xilitol'],              'emergency'),
('envenenamiento', 'keyword', ARRAY['lirio'],                'emergency'),
('envenenamiento', 'keyword', ARRAY['paracetamol'],          'emergency');

-- Trauma
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('trauma', 'keyword', ARRAY['atropellado'],        'emergency'),
('trauma', 'keyword', ARRAY['le ha atropellado'],  'emergency'),
('trauma', 'keyword', ARRAY['caida grave'],        'emergency'),
('trauma', 'keyword', ARRAY['fractura'],           'emergency'),
('trauma', 'keyword', ARRAY['golpe fuerte'],       'emergency'),
('trauma', 'keyword', ARRAY['mordedura grave'],    'emergency');

-- Intense pain / Abdomen
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('dolor',   'keyword', ARRAY['dolor muy fuerte'],            'emergency'),
('dolor',   'keyword', ARRAY['llora de dolor'],              'emergency'),
('dolor',   'keyword', ARRAY['grita de dolor'],              'emergency'),
('abdomen', 'keyword', ARRAY['abdomen hinchado'],            'emergency'),
('abdomen', 'keyword', ARRAY['barriga hinchada'],            'emergency'),
('abdomen', 'keyword', ARRAY['no puede orinar'],             'emergency'),
('abdomen', 'keyword', ARRAY['intenta orinar y no puede'],   'emergency'),
('abdomen', 'keyword', ARRAY['bloqueo urinario'],            'emergency');

-- Puppies / Kittens / Seniors
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('vulnerables', 'keyword', ARRAY['cachorro muy pequeno y aletargado'], 'emergency'),
('vulnerables', 'keyword', ARRAY['gatito recien nacido'],              'emergency'),
('vulnerables', 'keyword', ARRAY['muy viejo y no come'],               'urgent');

-- Combined rules (ALL keywords must be present)
INSERT INTO red_flag_patterns (category, pattern_type, keywords, severity) VALUES
('combinado', 'combined', ARRAY['vomita', 'sangre'],                      'emergency'),
('combinado', 'combined', ARRAY['no come', 'no bebe', 'aletargado'],      'emergency'),
('combinado', 'combined', ARRAY['diarrea acuosa', 'letargo'],             'emergency'),
('combinado', 'combined', ARRAY['diarrea acuosa', 'aletargado'],          'emergency'),
('combinado', 'combined', ARRAY['vomita', 'sin parar'],                   'emergency'),
('combinado', 'combined', ARRAY['fiebre', 'muy alta'],                    'urgent'),
('combinado', 'combined', ARRAY['fiebre', '40'],                          'urgent'),
('combinado', 'combined', ARRAY['fiebre', '41'],                          'emergency');

-- ============================================================
-- 12. SEED DATA: System Prompt (main)
-- ============================================================
INSERT INTO system_prompts (name, content, is_active) VALUES
('main_assistant', E'Eres MIA, la asistente veterinaria de la tienda online MundoMascotix en España.\n\nTu rol es el de una asistente farmacéutica veterinaria que orienta sobre productos, pero NO diagnosticas ni prescribes.\n\nINSTRUCCIONES OBLIGATORIAS:\n• Orienta sobre productos de la tienda: antiparasitarios, alimentación, suplementos, higiene, accesorios y otros productos veterinarios.\n• Usa ÚNICAMENTE la información del catálogo proporcionado (nombre del producto, especie, indicaciones).\n• Si el cliente pide un diagnóstico, ajuste de dosis, interpretación de síntomas o sustitución de medicamentos, responde SIEMPRE con algo como:\n  \"Por seguridad, esto debe valorarlo tu veterinario/a en persona. Puedo ayudarte a entender para qué sirve cada producto, pero no puedo diagnosticar ni ajustar tratamientos.\"\n• Escribe en español de España, con tono amable pero profesional.\n• Nunca prometas curas ni resultados garantizados.\n• Si no estás segura, dilo y sugiere consultar al veterinario.\n• No des instrucciones de dosificación específicas para medicamentos con receta.\n• Recomienda EXCLUSIVAMENTE productos del catálogo de la tienda.\n• Mantén las respuestas breves (máximo 6-10 líneas) y estructuradas.\n\nFORMATO DE RESPUESTA:\n• Resumen breve (1-2 frases).\n• Recomendación de producto(s) específico(s), si aplica, con enlace.\n• Aviso final si la situación puede requerir atención veterinaria: \"Si los síntomas persisten o empeoran, consulta con tu veterinario de confianza. Podemos recomendarte los mejores veterinarios de tu zona, solo indícanos tu código postal.\"\n\nPREGUNTAS SEGURAS QUE PUEDES HACER:\n• \"¿Es para perro o gato?\"\n• \"¿Peso aproximado?\"\n• \"¿Edad (cachorro/adulto/senior)?\"\n• \"¿Buscas algo mensual o de larga duración?\"\n• \"¿Prefieres spot-on, collar o pastilla?\"\n• \"¿Tiene alguna alergia conocida o recomendación previa de tu veterinario?\"\n\nSi el usuario describe síntomas leves, usa este mensaje de transición:\n\"Si tu consulta está relacionada con síntomas, lo más indicado es que tu veterinario lo valore. Si por el contrario necesitas elegir un producto (antiparasitario, dieta, higiene, etc.), dime la especie y el peso aproximado y te sugiero opciones del catálogo.\"\n\nREGLAS DE CONDUCTA FIJAS:\n1. Nunca prometas una cura ni digas \"esto lo solucionará\".\n2. Nunca indiques dosis ni pautas específicas de medicamentos con receta.\n3. Nunca sugieras \"no vayas al veterinario\".\n4. Si el usuario insiste en una consulta clínica → repite el límite y la derivación.\n5. Recomienda solo productos del catálogo.\n6. Respuestas breves y estructuradas (máx. 6-10 líneas).', true);

-- ============================================================
-- 13. SEED DATA: FAQs
-- ============================================================
INSERT INTO faqs (category, question, answer, keywords, priority) VALUES
('alimentacion',
 '¿Cuál es la dieta más adecuada según la especie y edad?',
 'La dieta ideal depende de la especie, raza, edad y estado de salud. En general, los cachorros necesitan alimentos con mayor contenido energético y proteico, los adultos requieren una dieta equilibrada de mantenimiento, y los senior necesitan fórmulas con menos calorías y más apoyo articular. Te puedo recomendar opciones de nuestro catálogo si me indicas la especie y edad de tu mascota.',
 ARRAY['dieta', 'alimentacion', 'comida', 'especie', 'edad'], 10),

('alimentacion',
 '¿Cuánto debe comer al día?',
 'La cantidad diaria depende del peso, edad, nivel de actividad y tipo de alimento. Cada producto de nuestro catálogo incluye una tabla de raciones recomendadas en su ficha. Te puedo orientar si me dices el producto que usas y el peso de tu mascota.',
 ARRAY['cantidad', 'comer', 'racion', 'dia'], 9),

('salud',
 '¿Necesito receta para este medicamento?',
 'Algunos medicamentos veterinarios requieren receta. En esos casos, la indicación y la dosis deben venir de tu veterinario. Si me dices el producto que te interesa, puedo indicarte si requiere receta y orientarte sobre alternativas que no la necesiten.',
 ARRAY['receta', 'medicamento', 'prescripcion'], 10),

('salud',
 '¿Cada cuánto debo desparasitar?',
 'Como norma general, se recomienda desparasitar internamente cada 3-4 meses en adultos y con más frecuencia en cachorros. Para la desparasitación externa (pulgas y garrapatas), depende del producto: algunos son mensuales y otros de larga duración. Te puedo recomendar opciones si me dices la especie y el peso.',
 ARRAY['desparasitar', 'parasitos', 'frecuencia', 'antiparasitario'], 10),

('higiene',
 '¿Cada cuánto debo bañarlo?',
 'Depende de la especie y el tipo de pelo. En perros, generalmente cada 4-6 semanas. En gatos, solo cuando sea necesario ya que se acicalan solos. Usar siempre champú específico para la especie. Puedo recomendarte productos de higiene de nuestro catálogo.',
 ARRAY['banar', 'bano', 'frecuencia', 'higiene'], 8);

COMMIT;

-- ============================================================
-- Done! All tables, indexes, triggers, views, and seed data
-- have been created successfully.
-- ============================================================
