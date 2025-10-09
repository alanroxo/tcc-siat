// src/ocorrencia.js
import { Router } from 'express';
import { pool } from './db.js';

const router = Router();
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

/* ===== Auth simples baseado em ADMIN_API_KEY ===== */
function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(500).json({ error: 'ADMIN_API_KEY não configurado no servidor' });
  }
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  const bearer = m ? m[1] : null;
  const apiKey = bearer || req.headers['x-api-key'];
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Acesso negado (admin apenas)' });
  }
  next();
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

// helper: garante 'YYYY-MM-DD'
function isoDateOnly(v) {
  if (!v) return null;
  try {
    if (typeof v === 'string') return v.slice(0, 10);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  } catch {
    return null;
  }
}

/* ===== GET (lista em formato para FullCalendar) ===== */
router.get('/', async (req, res) => {
  const start = isoDateOnly(req.query.start);
  const end = isoDateOnly(req.query.end);

  let sql = `SELECT id, crianca_id, nome, data, tipo, status, descricao FROM ocorrencias`;
  const params = {};

  if (start && end) {
    sql += ` WHERE data BETWEEN :start AND :end`;
    params.start = start;
    params.end = end;
  }

  sql += ` ORDER BY data DESC, id DESC`;

  const [rows] = await pool.execute(sql, params);

  const events = rows.map(r => ({
    id: r.id,
    title: `${r.nome} — ${cap(r.tipo)}`,
    start: (r.data instanceof Date) ? r.data.toISOString().slice(0,10) : String(r.data).slice(0,10),
    allDay: true,
    extendedProps: {
      crianca_id: r.crianca_id,
      nome: r.nome,
      tipo: r.tipo,
      status: r.status,
      descricao: r.descricao
    }
  }));

  res.json(events);
});

/* ===== GET list crua ===== */
router.get('/list', async (_req, res) => {
  const [rows] = await pool.execute(`
    SELECT id, crianca_id, nome, DATE_FORMAT(data,'%Y-%m-%d') as data, tipo, status, descricao
    FROM ocorrencias ORDER BY data DESC, id DESC LIMIT 500
  `);
  res.json({ items: rows });
});

/* ===== GET by id ===== */
router.get('/:id', async (req, res) => {
  const [rows] = await pool.execute(`
    SELECT id, crianca_id, nome, DATE_FORMAT(data,'%Y-%m-%d') as data, tipo, status, descricao
    FROM ocorrencias WHERE id=:id
  `, { id: req.params.id });
  if (!rows.length) return res.status(404).json({ error: 'Não encontrado' });
  res.json(rows[0]);
});

/* ===== POST (conselheiro e admin) ===== */
router.post('/', async (req, res) => {
  const { crianca_id=null, nome, data, tipo, status, descricao } = req.body || {};
  if (!nome || !data || !tipo || !status || !descricao)
    return res.status(400).json({ error: 'Campos obrigatórios: nome, data, tipo, status, descricao' });

  const [r] = await pool.execute(`
    INSERT INTO ocorrencias (crianca_id, nome, data, tipo, status, descricao)
    VALUES (:crianca_id, :nome, :data, :tipo, :status, :descricao)
  `, { crianca_id, nome: nome.trim(), data: data.slice(0,10), tipo, status, descricao: descricao.trim() });

  res.status(201).json({ ok: true, id: r.insertId });
});

/* ===== PUT (admin) ===== */
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { crianca_id=null, nome, data, tipo, status, descricao } = req.body || {};
  if (!nome || !data || !tipo || !status || !descricao)
    return res.status(400).json({ error: 'Campos obrigatórios: nome, data, tipo, status, descricao' });

  const [r] = await pool.execute(`
    UPDATE ocorrencias SET crianca_id=:crianca_id, nome=:nome, data=:data, tipo=:tipo, status=:status, descricao=:descricao
    WHERE id=:id
  `, { id, crianca_id, nome: nome.trim(), data: data.slice(0,10), tipo, status, descricao: descricao.trim() });

  if (!r.affectedRows) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ ok: true, id: Number(id) });
});

/* ===== DELETE (admin) ===== */
router.delete('/:id', requireAdmin, async (req, res) => {
  const [r] = await pool.execute(`DELETE FROM ocorrencias WHERE id=:id`, { id: req.params.id });
  if (!r.affectedRows) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ ok: true });
});

export default router;
