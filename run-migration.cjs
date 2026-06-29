const { Client } = require('pg');
const fs = require('fs');
const dns = require('dns');

// Usar DNS do Google para resolver, pois o DNS local bloqueia
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8', '8.8.4.4']);

async function resolveHost(hostname) {
  return new Promise((resolve, reject) => {
    resolver.resolve4(hostname, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses[0]);
    });
  });
}

async function run() {
  const password = 'rHn+XayBws7.4y2';
  const ref = 'kiifogmalbkcbwalhctc';

  // Ler SQL do argumento ou default
  const sqlFile = process.argv[2] || './migration-v9.sql';
  const sql = fs.readFileSync(sqlFile, 'utf8');
  console.log(`Executando: ${sqlFile}`);

  // Resolver DNS via Google
  console.log('Resolvendo DNS via Google (8.8.8.8)...');
  let poolerIP;
  try {
    poolerIP = await resolveHost('aws-0-sa-east-1.pooler.supabase.com');
    console.log(`Pooler IP: ${poolerIP}`);
  } catch (e) {
    console.log('❌ Falha ao resolver DNS:', e.message);
    return;
  }

  // Conectar usando IP mas com SNI (servername) para o pooler identificar o tenant
  const client = new Client({
    host: poolerIP,
    port: 6543,
    database: 'postgres',
    user: `postgres.${ref}`,
    password,
    ssl: {
      rejectUnauthorized: false,
      servername: 'aws-0-sa-east-1.pooler.supabase.com',
    },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('Conectado! Executando SQL...');
    await client.query(sql);
    console.log('✅ SQL executado com sucesso!');
  } catch (err) {
    console.log(`❌ Erro: ${err.message}`);
  } finally {
    await client.end();
  }
}

run();
