// test-db-connection.js
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'cmx_user',
  password: 'cmx_pass_dev',
  database: 'cmx_db',
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');
    
    const result = await client.query('SELECT NOW()');
    console.log('📅 Current database time:', result.rows[0].now);
    
    await client.end();
    console.log('✅ Connection closed');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
