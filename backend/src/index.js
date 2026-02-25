import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

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

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: [
    config.frontendUrl,
    'http://localhost:5173',
    'http://localhost:3000',
    /\.mundomascotix\.com$/,
  ],
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

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'MIA - Asistente Veterinaria de MundoMascotix',
    version: '1.0.0',
    status: 'running',
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

app.listen(config.port, () => {
  logger.info(`🐾 MIA Chatbot Backend running on port ${config.port}`);
  logger.info(`📋 Environment: ${config.nodeEnv}`);
  logger.info(`🔗 Frontend URL: ${config.frontendUrl}`);
  console.log(`\n🐾 MIA Chatbot Backend is running at http://localhost:${config.port}\n`);
});

export default app;
