const { Client } = require('pg');

async function run() {
  const client = new Client({
    host: '2600:1f1e:dbb:f601:5e7:8b4f:2fd7:f56c',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'rHn+XayBws7.4y2',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log('✅ Conectado via IPv6!');
    await client.query('ALTER TABLE alunos ADD COLUMN IF NOT EXISTS treino_hipertrofia BOOLEAN DEFAULT FALSE');
    await client.query("UPDATE alunos SET treino_hipertrofia = true WHERE email = 'covalsqui.arrabal@gmail.com'");
    console.log('✅ Migration executada!');
    await client.end();
  } catch(e) {
    console.log('❌', e.message);
    try { await client.end(); } catch(x) {}
  }
}
run();
