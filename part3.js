// Part 3: administrator API (role must be 'admin').
const jwt = require('jsonwebtoken');
const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'];
module.exports = (app, db) => {
  const admin = (req, res, next) => { try {
    const u = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    if (u.role !== 'admin') throw 0; req.user = u; next();
  } catch { res.status(403).json({ error: 'Administrators only.' }); } };

  app.get('/api/admin/complaints', admin, async (req, res) => {
    const { status, category, q } = req.query, w = [], p = [];
    if (status) { p.push(status); w.push(`c.status=$${p.length}`); }
    if (category) { p.push(category); w.push(`c.category=$${p.length}`); }
    if (q) { p.push('%' + q.trim() + '%'); w.push(`c.tracking_id ILIKE $${p.length}`); }
    const complaints = (await db.query(`SELECT c.tracking_id,c.category,c.title,c.description,c.status,c.admin_remarks,c.department,c.ai_generated,c.created_at,
      (c.user_id IS NULL) AS anonymous, u.name AS student_name,
      COALESCE((SELECT json_agg('/uploads/'||filename) FROM complaint_images i WHERE i.complaint_id=c.id),'[]') AS images
      FROM complaints c LEFT JOIN users u ON u.id=c.user_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY c.created_at DESC LIMIT 200`, p)).rows;
    const stats = (await db.query('SELECT status,count(*)::int AS n FROM complaints GROUP BY status')).rows;
    res.json({ complaints, stats });
  });

  app.patch('/api/admin/complaints/:id', admin, async (req, res) => {
    const { status, remarks, department } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const { rows } = await db.query('UPDATE complaints SET status=$1,admin_remarks=$2,department=$3 WHERE tracking_id=$4 RETURNING id',
      [status, remarks || null, department || null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Complaint not found.' });
    await db.query('INSERT INTO status_history(complaint_id,status,remark) VALUES($1,$2,$3)', [rows[0].id, status, remarks || null]);
    res.json({ ok: true });
  });
};
