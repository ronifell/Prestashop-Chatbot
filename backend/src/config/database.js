import pg from 'pg';
import config from './index.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,  // 10 seconds (remote DB needs more time)
  statement_timeout: 30000,        // 30 seconds max per query
  // SSL required for Supabase connections
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL');
});

/**
 * Execute a query with parameters
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query executed in ${duration}ms: ${text.substring(0, 80)}...`);
    return result;
  } catch (error) {
    logger.error(`Query error: ${error.message}`, { query: text, params });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  return pool.connect();
}

export default pool;
