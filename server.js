const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'meta2025';
const SESSION_SECRET = process.env.SESSION_SECRET || 'ranking-secret-key-mude-isso';

// ─── DATABASE ───────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'ranking.db'));

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS operators (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL UNIQUE,
    tickets  INTEGER DEFAULT 0,
    sla_in   INTEGER DEFAULT 0,
    sla_out  INTEGER DEFAULT 0,
    horas    TEXT DEFAULT '0:00:00',
    score    REAL DEFAULT 0,
    sort_order INTEGER DEFAULT 99
  );
`);

// Default config seed
const seedConfig = [
  ['abertos',   '172'],
  ['fechados',  '172'],
  ['horas',     '157:54:00'],
  ['dist',      'N1-118/N2-36/NOC-13/FIELD-5'],
  ['goal_sla',  '80'],
  ['goal_tickets', '20'],
];
const insertCfg = db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`);
seedConfig.forEach(([k, v]) => insertCfg.run(k, v));

// Default operators seed
const seedOps = [
  ['Anderson', 32, 25, 3,  '40:38:00', 3.5, 1],
  ['João',     29, 22, 3,  '24:14:00', 2.5, 2],
  ['Nicolly',  23, 16, 6,  '36:16:00', 1.5, 3],
  ['Everton',  27, 20, 6,  '22:22:00', 1.0, 4],
  ['Bruno',    28,  4, 20, '4:39:00',  0.5, 5],
  ['Eduardo',   9,  3, 5,  '10:35:00', 0,   6],
  ['Guilherme', 7,  3, 4,  '11:11:00', 0,   7],
  ['Lidiane',   6,  5, 1,  '0:01:00',  0,   8],
  ['Nubia',     6,  6, 0,  '0:30:00',  0,   9],
  ['Emily',     4,  2, 1,  '5:05:00',  0,  10],
  ['Patrik',    2,  0, 2,  '2:23:00',  0,  11],
];
const insertOp = db.prepare(`
  INSERT OR IGNORE INTO operators (name, tickets, sla_in, sla_out, horas, score, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
seedOps.forEach(op => insertOp.run(...op));

// ─── MIDDLEWARE ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8h
}));
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.status(401).json({ error: 'Não autorizado' });
}

// ─── AUTH ROUTES ────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.loggedIn = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Usuário ou senha incorretos' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth-check', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.loggedIn) });
});

// ─── PUBLIC API ─────────────────────────────────────────────
app.get('/api/data', (req, res) => {
  const configRows = db.prepare(`SELECT key, value FROM config`).all();
  const config = {};
  configRows.forEach(r => config[r.key] = r.value);

  const operators = db.prepare(`
    SELECT name, tickets, sla_in, sla_out, horas, score
    FROM operators ORDER BY score DESC, sla_in DESC, sort_order ASC
  `).all();

  res.json({
    header: {
      abertos:  parseInt(config.abertos  || 0),
      fechados: parseInt(config.fechados || 0),
      horas:    config.horas    || '0:00:00',
      dist:     config.dist     || '',
      slaIn:    operators.reduce((s, o) => s + o.sla_in,  0),
      slaOut:   operators.reduce((s, o) => s + o.sla_out, 0),
    },
    goals: {
      slaPct:  parseInt(config.goal_sla     || 80),
      tickets: parseInt(config.goal_tickets || 20),
      dist:    config.dist || '',
    },
    operators: operators.map(o => ({
      name:    o.name,
      tickets: o.tickets,
      slaIn:   o.sla_in,
      slaOut:  o.sla_out,
      horas:   o.horas,
      score:   o.score,
    }))
  });
});

// ─── ADMIN API ──────────────────────────────────────────────
app.post('/api/config', requireAuth, (req, res) => {
  const { abertos, fechados, horas, dist, goal_sla, goal_tickets } = req.body;
  const set = db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`);
  const many = db.transaction((entries) => {
    entries.forEach(([k, v]) => set.run(k, String(v)));
  });
  many([
    ['abertos',      abertos      ?? ''],
    ['fechados',     fechados     ?? ''],
    ['horas',        horas        ?? ''],
    ['dist',         dist         ?? ''],
    ['goal_sla',     goal_sla     ?? '80'],
    ['goal_tickets', goal_tickets ?? '20'],
  ]);
  res.json({ ok: true });
});

app.post('/api/operators', requireAuth, (req, res) => {
  const { operators } = req.body; // array
  const update = db.prepare(`
    UPDATE operators
    SET tickets=?, sla_in=?, sla_out=?, horas=?, score=?
    WHERE name=?
  `);
  const many = db.transaction((ops) => {
    ops.forEach(o => update.run(o.tickets, o.slaIn, o.slaOut, o.horas, o.score, o.name));
  });
  many(operators);
  res.json({ ok: true });
});

app.post('/api/operators/:name', requireAuth, (req, res) => {
  const { tickets, slaIn, slaOut, horas, score } = req.body;
  db.prepare(`
    UPDATE operators SET tickets=?, sla_in=?, sla_out=?, horas=?, score=?
    WHERE name=?
  `).run(tickets, slaIn, slaOut, horas, score, req.params.name);
  res.json({ ok: true });
});

// ─── SERVE SPA ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🏆 Ranking Operadores rodando em http://localhost:${PORT}`);
  console.log(`📦 Banco de dados: ${path.join(dataDir, 'ranking.db')}`);
  console.log(`👤 Admin: ${ADMIN_USER} / ${ADMIN_PASS}\n`);
});
