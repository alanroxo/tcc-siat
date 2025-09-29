import { Router } from 'express';
import { pool } from './db.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = `${Date.now()}-${Math.round(Math.random()*1e9)}`;
    cb(null, `${base}${ext}`);
  }
});
const upload = multer({ storage });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// LISTAGEM (para a tabela de relatórios)
router.get('/list', wrap(async (_req, res) => {
  const [rows] = await pool.execute(`
    SELECT c.id, c.nome, DATE(c.created_at) AS data_cadastro, c.status, c.foto_crianca
    FROM criancas c
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT 1000
  `);
  res.json({ items: rows });
}));

// GET detalhe
router.get('/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const [[crianca]] = await pool.execute(`SELECT * FROM criancas WHERE id=:id`, { id });
  if (!crianca) return res.status(404).json({ error: 'Não encontrado' });

  const [[endereco]] = await pool.execute(`SELECT * FROM enderecos WHERE crianca_id=:id`, { id });
  const [[resp]] = await pool.execute(`SELECT * FROM responsaveis WHERE crianca_id=:id`, { id });

  res.json({ crianca, endereco, responsavel: resp });
}));

// CREATE (multipart: fotos opcionais)
router.post(
  '/',
  upload.fields([{ name: 'foto_crianca', maxCount: 1 }, { name: 'foto_responsavel', maxCount: 1 }]),
  wrap(async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const b = req.body || {};
      const foto_crianca = (req.files?.foto_crianca?.[0]?.filename) ? `/uploads/${req.files.foto_crianca[0].filename}` : null;
      const foto_responsavel = (req.files?.foto_responsavel?.[0]?.filename) ? `/uploads/${req.files.foto_responsavel[0].filename}` : null;

      const [r1] = await conn.execute(`
        INSERT INTO criancas (nome, data_nascimento, cpf, genero, comorbidade, escolaridade, status, foto_crianca, observacoes_crianca)
        VALUES (:nome, :data_nascimento, :cpf, :genero, :comorbidade, :escolaridade, :status, :foto_crianca, :observacoes_crianca)
      `, {
        nome: b.nome, data_nascimento: b.data_nascimento, cpf: b.cpf || null, genero: b.genero,
        comorbidade: b.comorbidade, escolaridade: b.escolaridade, status: b.status || 'ativo',
        foto_crianca, observacoes_crianca: b.observacoes_crianca || null
      });
      const crianca_id = r1.insertId;

      await conn.execute(`
        INSERT INTO enderecos (crianca_id, uf, cidade, bairro, rua, numero)
        VALUES (:crianca_id, :uf, :cidade, :bairro, :rua, :numero)
      `, {
        crianca_id, uf: b.uf, cidade: b.cidade, bairro: b.bairro, rua: b.rua, numero: b.numero || null
      });

      await conn.execute(`
        INSERT INTO responsaveis (crianca_id, nome_responsavel, data_nascimento_responsavel, ocupacao,
          estado_civil_responsavel, genero_responsavel, telefone_responsavel, email_responsavel,
          foto_responsavel, observacao_responsavel)
        VALUES (:crianca_id, :nome_responsavel, :data_nascimento_responsavel, :ocupacao,
          :estado_civil_responsavel, :genero_responsavel, :telefone_responsavel, :email_responsavel,
          :foto_responsavel, :observacao_responsavel)
      `, {
        crianca_id,
        nome_responsavel: b.nome_responsavel, data_nascimento_responsavel: b.data_nascimento_responsavel,
        ocupacao: b.ocupacao, estado_civil_responsavel: b.estado_civil_responsavel, genero_responsavel: b.genero_responsavel,
        telefone_responsavel: b.telefone_responsavel, email_responsavel: b.email_responsavel,
        foto_responsavel, observacao_responsavel: b.observacao_responsavel || null
      });

      await conn.commit();
      res.status(201).json({ ok: true, id: crianca_id });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

// UPDATE (aceita multipart p/ trocar fotos)
router.put(
  '/:id',
  upload.fields([{ name: 'foto_crianca', maxCount: 1 }, { name: 'foto_responsavel', maxCount: 1 }]),
  wrap(async (req, res) => {
    const id = req.params.id;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const b = req.body || {};
      const foto_crianca = (req.files?.foto_crianca?.[0]?.filename) ? `/uploads/${req.files.foto_crianca[0].filename}` : null;
      const foto_responsavel = (req.files?.foto_responsavel?.[0]?.filename) ? `/uploads/${req.files.foto_responsavel[0].filename}` : null;

      const [r1] = await conn.execute(`
        UPDATE criancas SET
          nome=:nome, data_nascimento=:data_nascimento, cpf=:cpf, genero=:genero,
          comorbidade=:comorbidade, escolaridade=:escolaridade, status=:status,
          foto_crianca=COALESCE(:foto_crianca, foto_crianca),
          observacoes_crianca=:observacoes_crianca
        WHERE id=:id
      `, {
        id,
        nome: b.nome, data_nascimento: b.data_nascimento, cpf: b.cpf || null, genero: b.genero,
        comorbidade: b.comorbidade, escolaridade: b.escolaridade, status: b.status || 'ativo',
        foto_crianca, observacoes_crianca: b.observacoes_crianca || null
      });
      if (!r1.affectedRows) return res.status(404).json({ error: 'Não encontrado' });

      const [[existsAddr]] = await conn.execute(`SELECT id FROM enderecos WHERE crianca_id=:id`, { id });
      if (existsAddr) {
        await conn.execute(`
          UPDATE enderecos SET uf=:uf, cidade=:cidade, bairro=:bairro, rua=:rua, numero=:numero WHERE crianca_id=:id
        `, { id, uf: b.uf, cidade: b.cidade, bairro: b.bairro, rua: b.rua, numero: b.numero || null });
      } else {
        await conn.execute(`
          INSERT INTO enderecos (crianca_id, uf, cidade, bairro, rua, numero)
          VALUES (:id, :uf, :cidade, :bairro, :rua, :numero)
        `, { id, uf: b.uf, cidade: b.cidade, bairro: b.bairro, rua: b.rua, numero: b.numero || null });
      }

      const [[existsResp]] = await conn.execute(`SELECT id FROM responsaveis WHERE crianca_id=:id`, { id });
      if (existsResp) {
        await conn.execute(`
          UPDATE responsaveis SET
            nome_responsavel=:nome_responsavel, data_nascimento_responsavel=:data_nascimento_responsavel,
            ocupacao=:ocupacao, estado_civil_responsavel=:estado_civil_responsavel,
            genero_responsavel=:genero_responsavel, telefone_responsavel=:telefone_responsavel,
            email_responsavel=:email_responsavel,
            foto_responsavel=COALESCE(:foto_responsavel, foto_responsavel),
            observacao_responsavel=:observacao_responsavel
          WHERE crianca_id=:id
        `, {
          id,
          nome_responsavel: b.nome_responsavel, data_nascimento_responsavel: b.data_nascimento_responsavel,
          ocupacao: b.ocupacao, estado_civil_responsavel: b.estado_civil_responsavel, genero_responsavel: b.genero_responsavel,
          telefone_responsavel: b.telefone_responsavel, email_responsavel: b.email_responsavel,
          foto_responsavel, observacao_responsavel: b.observacao_responsavel || null
        });
      } else {
        await conn.execute(`
          INSERT INTO responsaveis (crianca_id, nome_responsavel, data_nascimento_responsavel, ocupacao,
            estado_civil_responsavel, genero_responsavel, telefone_responsavel, email_responsavel,
            foto_responsavel, observacao_responsavel)
          VALUES (:id, :nome_responsavel, :data_nascimento_responsavel, :ocupacao,
            :estado_civil_responsavel, :genero_responsavel, :telefone_responsavel, :email_responsavel,
            :foto_responsavel, :observacao_responsavel)
        `, {
          id,
          nome_responsavel: b.nome_responsavel, data_nascimento_responsavel: b.data_nascimento_responsavel,
          ocupacao: b.ocupacao, estado_civil_responsavel: b.estado_civil_responsavel, genero_responsavel: b.genero_responsavel,
          telefone_responsavel: b.telefone_responsavel, email_responsavel: b.email_responsavel,
          foto_responsavel, observacao_responsavel: b.observacao_responsavel || null
        });
      }

      await conn.commit();
      res.json({ ok: true, id: Number(id) });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

router.delete('/:id', wrap(async (req, res) => {
  const [r] = await pool.execute(`DELETE FROM criancas WHERE id=:id`, { id: req.params.id });
  if (!r.affectedRows) return res.status(404).json({ error: 'Não encontrado' });
  res.json({ ok: true });
}));

export default router;
