-- ============================================================
-- MIA Chatbot - Database Schema
-- MundoMascotix Veterinary Assistant
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================================
-- PRODUCTS TABLE (from PrestaShop catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    prestashop_id VARCHAR(50) UNIQUE,
    code VARCHAR(100),
    name VARCHAR(500) NOT NULL,
    brand VARCHAR(200),
    category VARCHAR(300),
    subcategory VARCHAR(300),
    species VARCHAR(200),          -- dog, cat, etc.
    price DECIMAL(10, 2),
    product_url TEXT,
    add_to_cart_url TEXT,
    image_url TEXT,
    description TEXT,
    indications TEXT,              -- What it's for
    active_ingredients TEXT,
    requires_prescription BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    search_vector TSVECTOR,        -- Full-text search
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_species ON products(species);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('spanish', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.category, '')), 'B') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.species, '')), 'B') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.brand, '')), 'C') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('spanish', COALESCE(NEW.indications, '')), 'C') ||
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
-- VETERINARY CLINICS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS vet_clinics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    address TEXT,
    city VARCHAR(200),
    province VARCHAR(200),
    postal_code VARCHAR(10) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(200),
    website TEXT,
    is_emergency BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vet_clinics_postal ON vet_clinics(postal_code);
CREATE INDEX IF NOT EXISTS idx_vet_clinics_active ON vet_clinics(is_active);

-- ============================================================
-- CONVERSATIONS TABLE (chat sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(100) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    has_emergency BOOLEAN DEFAULT FALSE,
    product_context JSONB,          -- Current product page context
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_date ON conversations(started_at);

-- ============================================================
-- MESSAGES TABLE (individual chat messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    response_type VARCHAR(50),      -- normal, emergency_warning, vet_referral, medical_limit, rx_limit
    red_flags_detected TEXT[],      -- Array of detected red flag keywords
    products_recommended INTEGER[], -- Array of product IDs recommended
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(response_type);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(created_at);

-- ============================================================
-- VADEMECUMS TABLE (PDF technical documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS vademecums (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(500) NOT NULL,
    original_name VARCHAR(500),
    content_text TEXT,              -- Extracted text from PDF
    content_chunks JSONB,           -- Split into chunks for context
    product_ids INTEGER[],          -- Related products
    file_hash VARCHAR(64),          -- SHA-256 for deduplication
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vademecums_active ON vademecums(is_active);

-- ============================================================
-- FAQS TABLE (editable FAQ knowledge base)
-- ============================================================
CREATE TABLE IF NOT EXISTS faqs (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[],                -- For matching
    priority INTEGER DEFAULT 0,    -- Higher = shown first
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_faqs_active ON faqs(is_active);

-- ============================================================
-- RED FLAGS CONFIG TABLE (editable red flag patterns)
-- ============================================================
CREATE TABLE IF NOT EXISTS red_flag_patterns (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    pattern_type VARCHAR(20) NOT NULL CHECK (pattern_type IN ('keyword', 'combined')),
    keywords TEXT[] NOT NULL,       -- Single keyword or array for combined rules
    severity VARCHAR(20) DEFAULT 'emergency' CHECK (severity IN ('emergency', 'urgent', 'caution')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_red_flags_active ON red_flag_patterns(is_active);

-- ============================================================
-- SYSTEM PROMPTS TABLE (versioned prompts)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_prompts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ANALYTICS / STATS VIEW
-- ============================================================
CREATE OR REPLACE VIEW chat_stats AS
SELECT
    DATE(m.created_at) AS chat_date,
    COUNT(DISTINCT m.conversation_id) AS total_conversations,
    COUNT(*) FILTER (WHERE m.role = 'user') AS total_user_messages,
    COUNT(*) FILTER (WHERE m.response_type = 'emergency_warning') AS emergencies,
    COUNT(*) FILTER (WHERE m.response_type = 'vet_referral') AS vet_referrals,
    COUNT(*) FILTER (WHERE m.response_type = 'medical_limit') AS medical_limits,
    COUNT(*) FILTER (WHERE m.response_type = 'rx_limit') AS rx_limits,
    AVG(m.processing_time_ms) FILTER (WHERE m.role = 'assistant') AS avg_response_time_ms
FROM messages m
GROUP BY DATE(m.created_at)
ORDER BY chat_date DESC;
