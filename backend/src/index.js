import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

import config from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Routes
import chatRoutes from './routes/chat.js';
import productRoutes from './routes/products.js';
import clinicRoutes from './routes/clinics.js';
import adminRoutes from './routes/admin.js';
import importRoutes from './routes/import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure required directories exist
const dirs = [
  join(__dirname, '../logs'),
  join(__dirname, '../data/imports'),
  join(__dirname, '../data/vademecums'),
];
dirs.forEach((dir) => {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (_) {}
});

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

// Trust proxy (required when behind Nginx/reverse proxy)
// This allows express-rate-limit to correctly read client IPs from X-Forwarded-For
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS Configuration
// ============================================================
// DEVELOPMENT: Allows localhost for local development
// PRODUCTION: Adds PrestaShop domain from config
// ============================================================
const corsOrigins = [
  config.frontendUrl,
  // Local development URLs (preserved for local dev)
  'http://localhost:5173',  // Vite dev server
  'http://localhost:3000',  // Alternative local port
  /\.mundomascotix\.com$/,  // PrestaShop domain pattern
];

// Add PrestaShop URL from config if provided (production)
if (config.prestashop?.url) {
  try {
    const prestashopUrl = new URL(config.prestashop.url);
    corsOrigins.push(prestashopUrl.origin);
  } catch (_) {
    // Invalid URL, skip
  }
}

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for chat endpoint
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Por favor, espera un momento.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for import/admin endpoints
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Demasiadas solicitudes de administración.',
  },
});

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// ============================================================
// ROUTES
// ============================================================

app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/products', productRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/import', adminLimiter, importRoutes);

// ============================================================
// STATIC FILE SERVING
// ============================================================
// PRODUCTION: Serve built frontend from dist folder
// DEVELOPMENT: Frontend is served by Vite dev server (port 5173)
//              This section is disabled in development
// ============================================================
if (config.nodeEnv === 'production') {
  const frontendDistPath = join(__dirname, '../../frontend/dist');
  if (existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    logger.info(`📦 Serving frontend from: ${frontendDistPath}`);
  } else {
    logger.warn(`⚠️  Frontend dist folder not found at ${frontendDistPath}. Run 'npm run build' in frontend/`);
  }
} else {
  // DEVELOPMENT: Frontend is served separately by Vite
  logger.info('🔧 Development mode: Frontend served by Vite dev server on port 5173');
}

// Root endpoint
app.get('/', (_req, res) => {
  // PRODUCTION: Serve the frontend index.html if available
  // DEVELOPMENT: Return API info (frontend is on Vite dev server)
  if (config.nodeEnv === 'production') {
    const indexPath = join(__dirname, '../../frontend/dist/index.html');
    if (existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  
  // DEVELOPMENT: Return API information
  // In development, access frontend at http://localhost:5173
  res.json({
    service: 'MIA - Asistente Veterinario de MundoMascotix',
    version: '1.0.0',
    status: 'running',
    environment: config.nodeEnv,
    note: config.nodeEnv === 'development' 
      ? 'Frontend available at http://localhost:5173' 
      : 'Frontend served from this server',
    endpoints: {
      chat: '/api/chat',
      products: '/api/products',
      clinics: '/api/clinics',
      admin: '/api/admin',
      import: '/api/import',
    },
  });
});

// ============================================================
// ERROR HANDLING
// ============================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// START SERVER
// ============================================================

app.listen(config.port, '0.0.0.0',() => {
  logger.info(`🐾 MIA Chatbot Backend running on port ${config.port}`);
  logger.info(`📋 Environment: ${config.nodeEnv}`);
  logger.info(`🔗 Frontend URL: ${config.frontendUrl}`);
  console.log(`\n🐾 MIA Chatbot Backend is running at http://localhost:${config.port}\n`);
});

export default app;
