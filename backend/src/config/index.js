import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'mundomascotix_chatbot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 800,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.4,
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  prestashop: {
    url: process.env.PRESTASHOP_URL || '',
    apiKey: process.env.PRESTASHOP_API_KEY || '',
  },
};

export default config;
