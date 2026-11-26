// Part 2: image upload, AI image analysis, complaint submission with pictures, tracking.
const multer = require('multer'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, f, cb) => EXT[f.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG or WEBP images are allowed.')) });

module.exports = (app, db, { CATS, newTrackingId }) => {
  fs.mkdirSync('uploads', { recursive: true });
  const optAuth = (req, _res, next) => { try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET); } catch {} next(); };

  // AI vision: returns a DRAFT only. Nothing is submitted here.
  app.post('/api/ai/analyze-image', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Attach an image.' });
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured. Write the description yourself.' });
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 500, messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: req.file.mimetype, data: req.file.buffer.toString('base64') } },
          { type: 'text', text: `You help university students report campus problems. Look at the photo and reply with JSON only (no markdown):
{"clear":boolean,"category":one of ${JSON.stringify(CATS)},"title":string,"description":string,"question":string}
Rules: describe only what is visibly shown. Never guess causes, locations or people. Phrase it as "The picture appears to show...". Keep the description to 1-2 polite sentences asking staff to inspect. If the image is unclear or not a campus issue, set clear=false, leave title/description empty and put a follow-up question for the student in "question".` }] }] }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.message || 'AI request failed');
      const out = JSON.parse(data.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim());
      if (!CATS.includes(out.category)) out.category = 'Other';
      res.json(out);
    } catch (e) { console.error(e.message); res.status(502).json({ error: 'AI could not analyse this image. Please write the description yourself.' }); }
  });

  // Submit complaint (logged-in or anonymous) with up to 5 images. Requires explicit confirmation.
  app.post('/api/complaints/submit', optAuth, upload.array('images', 5), async (req, res) => {
    const { category, title, description, anonymous, confirmed, aiGenerated } = req.body;
    if (confirmed !== 'true') return res.status(400).json({ error: 'Please confirm before submitting.' });
    if (!CATS.includes(category) || !title?.trim() || (description || '').trim().length < 10)
      return res.status(400).json({ error: 'Choose a category, add a title and describe the issue (10+ characters).' });
    const isAnon = anonymous === 'true' || !req.user;
    const trackingId = newTrackingId(), code = isAnon ? crypto.randomBytes(3).toString('hex').toUpperCase() : null;
    const { rows } = await db.query('INSERT INTO complaints(tracking_id,user_id,access_code_hash,category,title,description,ai_generated) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [trackingId, isAnon ? null : req.user.id, code && await bcrypt.hash(code, 10), category, title.trim(), description.trim(), aiGenerated === 'true']);
    await db.query('INSERT INTO status_history(complaint_id,status) VALUES($1,$2)', [rows[0].id, 'Submitted']);
    for (const f of req.files || []) {
      const name = crypto.randomBytes(16).toString('hex') + EXT[f.mimetype];
      fs.writeFileSync(path.join('uploads', name), f.buffer);
      await db.query('INSERT INTO complaint_images(complaint_id,filename) VALUES($1,$2)', [rows[0].id, name]);
    }
    res.json({ trackingId, accessCode: code });
  });

  // Tracking: anonymous complaints need ID + secret code; registered complaints need the owner's login.
  app.post('/api/track', optAuth, async (req, res) => {
    const { rows } = await db.query('SELECT * FROM complaints WHERE tracking_id=$1', [(req.body.trackingId || '').trim().toUpperCase()]);
    const c = rows[0], deny = () => res.status(404).json({ error: 'No complaint found for those details.' });
    if (!c) return deny();
    if (c.user_id) { if (!req.user || (req.user.id !== c.user_id && req.user.role !== 'admin')) return deny(); }
    else if (!c.access_code_hash || !(await bcrypt.compare((req.body.accessCode || '').trim().toUpperCase(), c.access_code_hash))) return deny();
    const history = (await db.query('SELECT status,remark,created_at FROM status_history WHERE complaint_id=$1 ORDER BY created_at', [c.id])).rows;
    const images = (await db.query('SELECT filename FROM complaint_images WHERE complaint_id=$1', [c.id])).rows.map(i => '/uploads/' + i.filename);
    res.json({ trackingId: c.tracking_id, category: c.category, title: c.title, description: c.description, status: c.status,
      remarks: c.admin_remarks, createdAt: c.created_at, history, images });
  });

  app.use((err, _req, res, next) => err ? res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Each picture must be under 5 MB.' : err.message }) : next());
};
