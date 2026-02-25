import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase
  },
  connectionTimeoutMillis: 5000,
});

async function testSupabaseConnection() {
  try {
    console.log('🔌 Testing Supabase connection...');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Port: ${process.env.DB_PORT}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log('Using SSL: Yes (required for Supabase)\n');
    
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    
    console.log('✅ Supabase connection successful!');
    console.log(`Current time: ${result.rows[0].current_time}`);
    console.log(`PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
    
    // Test if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`\n📊 Found ${tablesResult.rows.length} tables:`);
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('   ⚠️  No tables found. Run: npm run db:init');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Supabase connection failed!');
    console.error(`Error: ${error.message}`);
    console.error('\nPlease check:');
    console.error('1. Your .env file has correct Supabase credentials');
    console.error('2. You are using the connection pooler (port 6543)');
    console.error('3. SSL is enabled in the connection config');
    console.error('4. Your Supabase project is active');
    console.error('5. IP restrictions allow your connection (if configured)');
    await pool.end();
    process.exit(1);
  }
}

testSupabaseConnection();
