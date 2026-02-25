import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const { Client } = pg;

async function initDatabase() {
  // Determine if SSL is needed (for Supabase/cloud databases)
  const needsSSL = process.env.DB_HOST && !process.env.DB_HOST.includes('localhost');
  const sslConfig = needsSSL ? { rejectUnauthorized: false } : false;

  // First, connect to default 'postgres' database to create our DB
  const adminClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: sslConfig,
  });

  const dbName = process.env.DB_NAME || 'mundomascotix_chatbot';

  try {
    await adminClient.connect();
    console.log('🔌 Connected to PostgreSQL server');

    // Check if database exists
    const dbCheck = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (dbCheck.rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database "${dbName}" created`);
    } else {
      console.log(`ℹ️  Database "${dbName}" already exists`);
    }

    await adminClient.end();

    // Now connect to our database and run schema
    const appClient = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: dbName,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: sslConfig,
    });

    await appClient.connect();
    console.log(`🔌 Connected to database "${dbName}"`);

    // Run schema
    const schemaSQL = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await appClient.query(schemaSQL);
    console.log('✅ Schema created successfully');

    // Run seed data
    const seedSQL = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
    await appClient.query(seedSQL);
    console.log('✅ Seed data inserted successfully');

    await appClient.end();
    console.log('\n🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    process.exit(1);
  }
}

initDatabase();
