require('dotenv').config();
const express = require('express'), cors = require('cors'), bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'), crypto = require('crypto'), { Pool } = require('pg');
const app = express(), db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '') ? false : { rejectUnauthorized: false } });
app.use(cors({ origin: process.env.CLIENT_URL })); app.use(express.json());

const CATS = ['Wi-Fi / Internet','Water Supply','Electricity','Hostel Issues','Classroom Issues','Cleanliness',
  'Washroom / Sanitation','Library','Laboratory','Transportation','Security','Other'];
const sign = u => jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const auth = (req, res, next) => { try {
  req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET); next();
} catch { res.status(401).json({ error: 'Please log in.' }); } };
const newTrackingId = () => 'CMP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
const valid = b => CATS.includes(b.category) && b.title?.trim() && (b.description || '').trim().length >= 10;
const BAD = { error: 'Choose a category, add a title and describe the issue (10+ characters).' };

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 6)
    return res.status(400).json({ error: 'Enter a name, a valid email and a password of 6+ characters.' });
  try {
    const { rows } = await db.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role',
      [name.trim(), email.toLowerCase(), await bcrypt.hash(password, 10)]);
    res.json({ token: sign(rows[0]), user: rows[0] });
  } catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'Email already registered.' : 'Server error.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [(req.body.email || '').toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash))) return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: sign(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});

// Anonymous: no auth, no personal data stored. Returns tracking ID + secret code (shown once).
app.post('/api/complaints/anonymous', async (req, res) => {
  if (!valid(req.body)) return res.status(400).json(BAD);
  const { category, title, description } = req.body, trackingId = newTrackingId(), code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const { rows } = await db.query('INSERT INTO complaints(tracking_id,access_code_hash,category,title,description) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [trackingId, await bcrypt.hash(code, 10), category, title.trim(), description.trim()]);
  await db.query('INSERT INTO status_history(complaint_id,status) VALUES($1,$2)', [rows[0].id, 'Submitted']);
  res.json({ trackingId, accessCode: code });
});
app.post('/api/complaints', auth, async (req, res) => {
  if (!valid(req.body)) return res.status(400).json(BAD);
  const { category, title, description } = req.body, trackingId = newTrackingId();
  const { rows } = await db.query('INSERT INTO complaints(tracking_id,user_id,category,title,description) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [trackingId, req.user.id, category, title.trim(), description.trim()]);
  await db.query('INSERT INTO status_history(complaint_id,status) VALUES($1,$2)', [rows[0].id, 'Submitted']);
  res.json({ trackingId });
});
app.get('/api/complaints/mine', auth, async (req, res) =>
  res.json((await db.query('SELECT tracking_id,category,title,status,created_at FROM complaints WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id])).rows));

app.use('/uploads', express.static('uploads'));
require('./part2')(app, db, { CATS, newTrackingId });
require('./part3')(app, db);
app.get('/', (_q, r) => r.send('Campus Dude API OK'));

app.listen(process.env.PORT || 5000, () => console.log('API running'));
