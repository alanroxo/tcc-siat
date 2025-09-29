// src/app.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

import ocorrenciasRouter from './ocorrencia.js';
import criancasRouter from './criancas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

/* ============== MySQL ============== */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'siat',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
(async () => {
  try { const c = await pool.getConnection(); await c.ping(); c.release(); console.log('[MySQL] conexão OK'); }
  catch (e) { console.error('[MySQL] falha ao conectar:', e?.message || e); }
})();

/* ============== Admin (opcional .env) ============== */
const ADMIN_API_KEY   = String(process.env.ADMIN_API_KEY || '').trim();
const ENV_ADMIN_USER  = String(process.env.ADMIN_USER || '').trim().toLowerCase();
const ENV_ADMIN_PASS  = String(process.env.ADMIN_PASS || '').trim();

/* ============== Static & Pages ============== */
app.use(express.static(path.join(__dirname, '../public')));
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/imagens', express.static(path.join(__dirname, '../imagens')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../public/home.html')));
app.get('/home', (_req, res) => res.sendFile(path.join(__dirname, '../public/home.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/adm', (_req, res) => res.sendFile(path.join(__dirname, '../public/adm.html')));

/* ============== Helpers auth/login ============== */
const normRole = (r = '') => {
  const v = String(r).toLowerCase().trim();
  if (['adm','admin','administrador','administrator'].includes(v)) return 'administrador';
  if (['conselheiro','conselho','cons'].includes(v)) return 'conselheiro';
  return v;
};
async function findAccount(role, userOrEmail) {
  const roleNorm = normRole(role);
  const u = String(userOrEmail || '').toLowerCase();
  const roleCandidates = roleNorm === 'administrador' ? ['adm','admin','administrador'] : ['conselheiro','cons','conselho'];
  const sql = `
    SELECT id, nome, senha, tipo
      FROM contas
     WHERE LOWER(nome)=?
       AND LOWER(tipo) IN (?,?,?)
     LIMIT 1`;
  const [rows] = await pool.query(sql, [u, ...roleCandidates.map(s=>s.toLowerCase())]);
  return rows?.[0] || null;
}
async function verifyPassword(dbPassword, inputPassword) {
  if (!dbPassword) return false;
  if (/^\$2[aby]\$/.test(dbPassword)) {
    try { return await bcrypt.compare(inputPassword, dbPassword); } catch { return false; }
  }
  return dbPassword === inputPassword;
}

app.post('/api/login', async (req, res) => {
  try {
    const role = normRole(req.body.role);
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!role || !username || !password) return res.status(400).json({ ok:false, message:'Dados incompletos.' });

    const acc = await findAccount(role, username);
    if (acc) {
      const passOk = await verifyPassword(acc.senha, password);
      if (!passOk) return res.status(401).json({ ok:false, message:'Usuário ou senha inválidos.' });

      const papel = normRole(acc.tipo);
      if (papel === 'administrador') {
        if (!ADMIN_API_KEY) return res.status(500).json({ ok:false, message:'ADMIN_API_KEY não configurado.' });
        return res.json({ ok:true, role:'administrador', user:acc.nome, token:ADMIN_API_KEY });
      }
      return res.json({ ok:true, role:'conselheiro', user:acc.nome, token: Buffer.from(`c:${acc.id}:${Date.now()}`).toString('base64') });
    }

    if (role === 'administrador' && ENV_ADMIN_USER && ENV_ADMIN_PASS) {
      if (username.toLowerCase() === ENV_ADMIN_USER && password === ENV_ADMIN_PASS) {
        if (!ADMIN_API_KEY) return res.status(500).json({ ok:false, message:'ADMIN_API_KEY não configurado.' });
        return res.json({ ok:true, role:'administrador', user:username, token:ADMIN_API_KEY });
      }
    }

    return res.status(401).json({ ok:false, message:'Usuário ou senha inválidos.' });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ ok:false, message:'Erro no servidor.' });
  }
});

/* ============== Proteção de ADMIN para /api/contas ============== */
function adminGuard(req, res, next) {
  const hdr = String(req.get('authorization') || '');
  const token = hdr.replace(/^Bearer\s+/i, '');
  if (!ADMIN_API_KEY || token !== ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  next();
}

/* ============== CRUD de contas (tabela `contas`) ============== */
// LISTAR (opcional ?tipo=conselheiro|adm)
app.get('/api/contas', adminGuard, async (req, res) => {
  try {
    const tipo = String(req.query.tipo || '').trim().toLowerCase();
    let sql = 'SELECT id, nome, tipo, created_at, updated_at FROM contas';
    const params = [];
    if (tipo) { sql += ' WHERE LOWER(tipo)=?'; params.push(tipo); }
    sql += ' ORDER BY id ASC';
    const [rows] = await pool.query(sql, params);
    return res.json({ items: rows || [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Falha ao listar contas' });
  }
});

// CRIAR
app.post('/api/contas', adminGuard, async (req, res) => {
  try {
    const { nome, senha, tipo } = req.body || {};
    const nomeOk = String(nome || '').trim();
    const tipoOk = String(tipo || '').trim().toLowerCase() || 'conselheiro';
    const senhaOk = String(senha || '').trim();
    if (!nomeOk || !senhaOk) return res.status(400).json({ error:'Informe nome e senha.' });
    if (!['conselheiro','adm','administrador','admin'].includes(tipoOk)) {
      return res.status(400).json({ error:'Tipo inválido.' });
    }
    // pode hash opcionalmente; mantém compat: aceitará bcrypt ou texto puro
    const senhaToStore = senhaOk; // ou: await bcrypt.hash(senhaOk, 10)

    const [r] = await pool.query(
      'INSERT INTO contas (nome, senha, tipo, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [nomeOk, senhaToStore, tipoOk === 'adm' ? 'adm' : (tipoOk === 'administrador' ? 'adm' : 'conselheiro')]
    );
    return res.status(201).json({ ok:true, id: r.insertId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Falha ao criar conta' });
  }
});

// ATUALIZAR
app.put('/api/contas/:id', adminGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, senha, tipo } = req.body || {};
    if (!id) return res.status(400).json({ error:'ID inválido.' });

    const fields = [];
    const params = [];
    if (nome) { fields.push('nome=?'); params.push(String(nome).trim()); }
    if (tipo) {
      const t = String(tipo).trim().toLowerCase();
      if (!['conselheiro','adm','administrador','admin'].includes(t)) return res.status(400).json({ error:'Tipo inválido.' });
      fields.push('tipo=?'); params.push(t === 'adm' ? 'adm' : (t === 'administrador' ? 'adm' : 'conselheiro'));
    }
    if (senha) {
      const s = String(senha).trim();
      if (s) { fields.push('senha=?'); params.push(s /* ou await bcrypt.hash(s,10) */); }
    }
    if (!fields.length) return res.json({ ok:true }); // nada pra mudar

    const sql = `UPDATE contas SET ${fields.join(', ')}, updated_at=NOW() WHERE id=?`;
    params.push(id);
    await pool.query(sql, params);
    return res.json({ ok:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Falha ao atualizar conta' });
  }
});

// EXCLUIR
app.delete('/api/contas/:id', adminGuard, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error:'ID inválido.' });
    await pool.query('DELETE FROM contas WHERE id=?', [id]);
    return res.json({ ok:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Falha ao excluir conta' });
  }
});

/* ============== APIs existentes ============== */
app.use('/api/criancas', criancasRouter);
app.use('/api/ocorrencias', ocorrenciasRouter);

/* ============== Handler de erro ============== */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`API em http://localhost:${PORT}`));
