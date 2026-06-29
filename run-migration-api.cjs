const fs = require('fs');
const https = require('https');

const SUPABASE_URL = 'https://kiifogmalbkcbwalhctc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpaWZvZ21hbGJrY2J3YWxoY3RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEzOTk4NiwiZXhwIjoyMDk3NzE1OTg2fQ.aHqLdThV8jKWRO1dPqk_3qS_rzocVv4ZymXYetaOhHk';

const sql = fs.readFileSync('./migration-v9.sql', 'utf8');

// Split SQL into individual statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

async function execStatement(statement) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: statement });
    const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Tentando executar migration via RPC...');
  
  // First try: single RPC call
  const result = await execStatement(sql);
  if (result.status === 200 || result.status === 204) {
    console.log('✅ Migration v9 executada com sucesso!');
    return;
  }
  
  console.log(`RPC não disponível (${result.status}). Tentando via pg-meta...`);
  
  // Try pg-meta endpoint
  const pgResult = await new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const options = {
      hostname: 'kiifogmalbkcbwalhctc.supabase.co',
      path: '/pg/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(data),
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  if (pgResult.status === 200 || pgResult.status === 201) {
    console.log('✅ Migration v9 executada com sucesso via pg-meta!');
  } else {
    console.log(`❌ pg-meta falhou (${pgResult.status}): ${pgResult.body.substring(0, 200)}`);
    console.log('\n⚠️ Não foi possível executar automaticamente.');
    console.log('Por favor, execute o seguinte SQL no Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/kiifogmalbkcbwalhctc/sql');
    console.log('\n' + sql);
  }
}

run().catch(console.error);
