import { useState, useEffect } from 'react';
import { MessageCircle, ShieldCheck, EyeOff, Search, LogOut, FilePlus2, ListChecks, Bell, Star, User, Bot, ImagePlus, Sparkles, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const CATS = ['Wi-Fi / Internet','Water Supply','Electricity','Hostel Issues','Classroom Issues','Cleanliness','Washroom / Sanitation','Library','Laboratory','Transportation','Security','Other'];
async function api(path, method = 'GET', body, token) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d;
}
const input = 'w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500';
const btn = 'rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 transition disabled:opacity-50';
const Card = ({ children, className = '' }) => <div className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 ${className}`}>{children}</div>;

function Home({ go }) {
  return (<div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
    <header className="mx-auto flex max-w-6xl items-center justify-between p-6">
      <span className="flex items-center gap-2 text-xl font-bold text-blue-800"><Bot /> Campus Dude</span>
      <div className="flex gap-3"><button onClick={() => go('login')} className="px-4 py-2 font-medium text-blue-800">Log in</button>
        <button onClick={() => go('register')} className={btn}>Register</button></div>
    </header>
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <h1 className="max-w-3xl text-4xl font-bold leading-tight text-slate-900 md:text-6xl">Something broken on campus? Tell us and track the fix.</h1>
      <p className="mt-6 max-w-xl text-lg text-slate-600">Report Wi-Fi, water, hostel or classroom problems and follow every update until it is resolved.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={() => go('login')} className={btn}>Log in to report</button>
        <button onClick={() => go('anon')} className="flex items-center gap-2 rounded-xl border border-blue-700 px-5 py-3 font-semibold text-blue-800 hover:bg-blue-50"><EyeOff size={18} /> Report anonymously</button>
        <button onClick={() => go('track')} className="flex items-center gap-2 px-5 py-3 font-semibold text-blue-800"><Search size={18} /> Track a complaint</button>
      </div>
    </section>
    <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
      {[[ShieldCheck, 'Private by design', 'Anonymous reports store no name, email or phone.'], [Search, 'Track with an ID', 'Every complaint gets a tracking ID.'], [MessageCircle, 'Chat with Campus Dude', 'Our assistant helps you write the complaint.']].map(([I, t, d]) =>
        <Card key={t}><I className="text-blue-700" /><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-slate-600">{d}</p></Card>)}
    </section></div>);
}

function Auth({ mode, onAuth, go }) {
  const [f, setF] = useState({ name: '', email: '', password: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setErr('');
    try { onAuth(await api(`/api/auth/${mode}`, 'POST', f)); } catch (e) { setErr(e.message); } setBusy(false); };
  return (<div className="grid min-h-screen place-items-center bg-blue-50 p-4"><Card className="w-full max-w-md space-y-4">
    <h2 className="text-2xl font-bold">{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
    {mode === 'register' && <input className={input} placeholder="Full name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />}
    <input className={input} placeholder="University email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
    <input className={input} type="password" placeholder="Password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
    {err && <p className="text-sm text-red-600">{err}</p>}
    <button className={btn + ' w-full'} disabled={busy} onClick={submit}>{mode === 'login' ? 'Log in' : 'Register'}</button>
    {mode === 'login' && <p className="text-sm text-slate-500">Forgot password? Reset arrives in a later part.</p>}
    <div className="flex justify-between text-sm"><button className="text-blue-700" onClick={() => go(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New student? Register' : 'Have an account? Log in'}</button>
      <button className="text-slate-500" onClick={() => go('home')}>Back</button></div>
  </Card></div>);
}

const postForm = async (path, fd, token) => {
  const r = await fetch(API + path, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: fd });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d;
};

function ComplaintForm({ token, onDone }) {
  const [f, setF] = useState({ category: '', title: '', description: '' }), [files, setFiles] = useState([]);
  const [err, setErr] = useState(''), [res, setRes] = useState(null), [busy, setBusy] = useState(false);
  const [ai, setAi] = useState({ loading: false, note: '', used: false }), [ok, setOk] = useState(false);
  const addFiles = e => { const next = [...files];
    for (const file of e.target.files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setErr('Only JPG, PNG or WEBP images are allowed.'); continue; }
      if (file.size > 5 * 1024 * 1024) { setErr(file.name + ' is over 5 MB.'); continue; }
      if (next.length >= 5) { setErr('You can attach up to 5 pictures.'); break; }
      next.push({ file, url: URL.createObjectURL(file) }); }
    setFiles(next); e.target.value = ''; };
  const analyse = async () => { setAi({ loading: true, note: '', used: false }); setErr('');
    try { const fd = new FormData(); fd.append('image', files[0].file);
      const d = await postForm('/api/ai/analyze-image', fd);
      if (!d.clear) setAi({ loading: false, used: false, note: d.question || 'The picture is unclear. Please add more details yourself.' });
      else { setF({ category: d.category, title: d.title, description: d.description }); setAi({ loading: false, used: true, note: 'AI draft added. Please check and edit it.' }); }
    } catch (e) { setAi({ loading: false, used: false, note: e.message }); } };
  const submit = async () => { setBusy(true); setErr('');
    try { const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      fd.append('anonymous', String(!token)); fd.append('confirmed', 'true'); fd.append('aiGenerated', String(ai.used));
      files.forEach(x => fd.append('images', x.file)); setRes(await postForm('/api/complaints/submit', fd, token));
    } catch (e) { setErr(e.message); } setBusy(false); };
  if (res) return (<Card className="space-y-3"><h3 className="text-xl font-bold text-green-700">Complaint submitted</h3>
    <p>Tracking ID: <b className="font-mono">{res.trackingId}</b></p>
    {res.accessCode && <p className="rounded-xl bg-amber-50 p-3 text-amber-900">Secret code: <b className="font-mono">{res.accessCode}</b>. Save both now. The code is shown only once and is needed to track this complaint.</p>}
    <button className={btn} onClick={onDone}>Done</button></Card>);
  return (<Card className="space-y-4">
    {!token && <p className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900"><EyeOff size={16} /> No name, email or phone is collected.</p>}
    <div><label className="mb-2 flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-blue-400 px-4 py-3 text-blue-800"><ImagePlus size={18} /> Add pictures (up to 5, 5 MB each)
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addFiles} /></label>
      <div className="flex flex-wrap gap-2">{files.map((x, i) => <div key={x.url} className="relative"><img src={x.url} className="h-20 w-20 rounded-xl object-cover" />
        <button aria-label="Remove picture" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white"><X size={12} /></button></div>)}</div>
      {files.length > 0 && <button disabled={ai.loading} onClick={analyse} className="mt-3 flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"><Sparkles size={16} />{ai.loading ? 'Analysing the first picture...' : 'Write description with AI'}</button>}
      {ai.note && <p className="mt-2 text-sm text-slate-600">{ai.note}</p>}</div>
    <select className={input} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}><option value="">Choose a category</option>{CATS.map(c => <option key={c}>{c}</option>)}</select>
    <input className={input} placeholder="Short title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
    <textarea className={input} rows={5} placeholder="Describe the problem (you can write your own or edit the AI draft)" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={ok} onChange={e => setOk(e.target.checked)} /> I have checked these details and want to submit this complaint.</label>
    {err && <p className="text-sm text-red-600">{err}</p>}
    <button className={btn} disabled={busy || !ok} onClick={submit}>Submit complaint</button></Card>);
}

function Track({ token }) {
  const [q, setQ] = useState({ trackingId: '', accessCode: '' }), [c, setC] = useState(null), [err, setErr] = useState('');
  const go = async () => { setErr(''); setC(null); try { setC(await api('/api/track', 'POST', q, token)); } catch (e) { setErr(e.message); } };
  return (<div className="max-w-xl space-y-4"><Card className="space-y-3">
    <input className={input} placeholder="Tracking ID (CMP-XXXXXXXX)" value={q.trackingId} onChange={e => setQ({ ...q, trackingId: e.target.value })} />
    <input className={input} placeholder="Secret code (anonymous complaints only)" value={q.accessCode} onChange={e => setQ({ ...q, accessCode: e.target.value })} />
    {err && <p className="text-sm text-red-600">{err}</p>}<button className={btn} onClick={go}>Track complaint</button></Card>
    {c && <Card className="space-y-3"><div className="flex items-center justify-between"><b>{c.title}</b><span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800">{c.status}</span></div>
      <p className="text-sm text-slate-500">{c.trackingId} · {c.category} · {new Date(c.createdAt).toLocaleDateString()}</p><p>{c.description}</p>
      {c.remarks && <p className="rounded-xl bg-blue-50 p-3 text-sm">Admin remarks: {c.remarks}</p>}
      <div className="flex flex-wrap gap-2">{c.images.map(u => <a key={u} href={API + u} target="_blank"><img src={API + u} className="h-24 w-24 rounded-xl object-cover" /></a>)}</div>
      <ol className="space-y-2 border-l-2 border-blue-200 pl-4">{c.history.map((h, i) => <li key={i} className="text-sm"><b>{h.status}</b> <span className="text-slate-500">{new Date(h.created_at).toLocaleString()}</span>{h.remark && <p>{h.remark}</p>}</li>)}</ol></Card>}</div>);
}

function TrackPage({ go }) {
  return (<div className="min-h-screen bg-blue-50 p-4"><div className="mx-auto max-w-xl space-y-4 py-8"><button className="text-blue-700" onClick={() => go('home')}>Back</button>
    <h2 className="text-2xl font-bold">Track a complaint</h2><Track /></div></div>);
}

function Anon({ go }) {
  return (<div className="min-h-screen bg-blue-50 p-4"><div className="mx-auto max-w-xl space-y-4 py-8">
    <button className="text-blue-700" onClick={() => go('home')}>Back</button><h2 className="text-2xl font-bold">Report anonymously</h2>
    <ComplaintForm onDone={() => go('home')} /></div></div>);
}

function Dashboard({ user, token, logout }) {
  const [view, setView] = useState('home'), [list, setList] = useState([]);
  const open = async v => { setView(v); if (v === 'mine') setList(await api('/api/complaints/mine', 'GET', null, token).catch(() => [])); };
  const nav = [['new', FilePlus2, 'Register a complaint'], ['anon', EyeOff, 'Anonymous complaint'], ['chat', MessageCircle, 'Chat with Campus Dude'], ['mine', ListChecks, 'My complaints'],
    ['track', Search, 'Track complaint'], ['notif', Bell, 'Notifications'], ['fb', Star, 'Feedback'], ['prof', User, 'Profile']];
  return (<div className="min-h-screen bg-slate-50 md:flex">
    <aside className="bg-blue-800 p-4 text-white md:min-h-screen md:w-64"><div className="mb-4 flex items-center gap-2 text-lg font-bold"><Bot /> Campus Dude</div>
      <nav className="flex gap-1 overflow-x-auto md:flex-col">{nav.map(([k, I, l]) => <button key={k} onClick={() => open(k)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-blue-700 ${view === k ? 'bg-blue-700' : ''}`}><I size={16} />{l}</button>)}
        <button onClick={logout} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-blue-700"><LogOut size={16} />Log out</button></nav></aside>
    <main className="flex-1 p-6"><h2 className="mb-4 text-2xl font-bold">Welcome, {user.name}</h2>
      {view === 'home' && <Card>Pick an option on the left to get started.</Card>}
      {(view === 'new' || view === 'anon') && <div className="max-w-xl"><ComplaintForm key={view} token={view === 'new' ? token : null} onDone={() => setView('home')} /></div>}
      {view === 'mine' && <div className="space-y-3">{list.length === 0 ? <Card>You have no complaints yet.</Card> : list.map(c => <Card key={c.tracking_id}><b>{c.title}</b> <span className="ml-2 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800">{c.status}</span><p className="text-sm text-slate-500">{c.tracking_id} · {c.category}</p></Card>)}</div>}
      {view === 'track' && <Track token={token} />}
      {['chat', 'notif', 'fb', 'prof'].includes(view) && <Card>This section is built in a later part.</Card>}
    </main></div>);
}

const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Rejected'];
function Admin({ user, token, logout }) {
  const [data, setData] = useState({ complaints: [], stats: [] }), [fl, setFl] = useState({ status: '', category: '', q: '' });
  const [open, setOpen] = useState(null), [edit, setEdit] = useState({}), [msg, setMsg] = useState('');
  const load = async () => { const qs = new URLSearchParams(Object.entries(fl).filter(([, v]) => v)).toString();
    try { setData(await api('/api/admin/complaints?' + qs, 'GET', null, token)); setMsg(''); } catch (e) { setMsg(e.message); } };
  useEffect(() => { load(); }, [fl]);
  const n = s => data.stats.find(x => x.status === s)?.n || 0, total = data.stats.reduce((a, x) => a + x.n, 0);
  const save = async c => { try { await api('/api/admin/complaints/' + c.tracking_id, 'PATCH', edit, token); setMsg('Saved.'); load(); } catch (e) { setMsg(e.message); } };
  return (<div className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-5xl space-y-4">
    <div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-2xl font-bold text-blue-800"><ShieldCheck /> Admin: {user.name}</h1>
      <button onClick={logout} className="flex items-center gap-2 text-blue-800"><LogOut size={16} /> Log out</button></div>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">{[['Total', total], ['Pending', n('Submitted')], ...STATUSES.slice(1).map(s => [s, n(s)])].map(([l, v]) =>
      <Card key={l} className="!p-4"><div className="text-2xl font-bold text-blue-800">{v}</div><div className="text-sm text-slate-500">{l}</div></Card>)}</div>
    <Card className="grid gap-3 md:grid-cols-3">
      <input className={input} placeholder="Search by complaint ID" value={fl.q} onChange={e => setFl({ ...fl, q: e.target.value })} />
      <select className={input} value={fl.category} onChange={e => setFl({ ...fl, category: e.target.value })}><option value="">All categories</option>{CATS.map(c => <option key={c}>{c}</option>)}</select>
      <select className={input} value={fl.status} onChange={e => setFl({ ...fl, status: e.target.value })}><option value="">All statuses</option>{STATUSES.map(c => <option key={c}>{c}</option>)}</select></Card>
    {msg && <p className="text-sm text-blue-800">{msg}</p>}
    {data.complaints.length === 0 && <Card>No complaints match these filters.</Card>}
    {data.complaints.map(c => <Card key={c.tracking_id} className="space-y-3">
      <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => { setOpen(open === c.tracking_id ? null : c.tracking_id); setEdit({ status: c.status, remarks: c.admin_remarks || '', department: c.department || '' }); }}>
        <span><b>{c.title}</b><span className="block text-sm text-slate-500">{c.tracking_id} · {c.category} · {c.anonymous ? 'Anonymous' : c.student_name}{c.ai_generated ? ' · AI-drafted' : ''}</span></span>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800">{c.status}</span></button>
      {open === c.tracking_id && <div className="space-y-3"><p>{c.description}</p>
        <div className="flex flex-wrap gap-2">{c.images.map(u => <a key={u} href={API + u} target="_blank"><img src={API + u} className="h-24 w-24 rounded-xl object-cover" /></a>)}</div>
        <div className="grid gap-3 md:grid-cols-2"><select className={input} value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
          <input className={input} placeholder="Assign department" value={edit.department} onChange={e => setEdit({ ...edit, department: e.target.value })} /></div>
        <textarea className={input} rows={3} placeholder="Remarks visible to the student" value={edit.remarks} onChange={e => setEdit({ ...edit, remarks: e.target.value })} />
        <button className={btn} onClick={() => save(c)}>Save update</button></div>}</Card>)}
  </div></div>);
}

export default function App() {
  const [page, setPage] = useState('home'), [session, setSession] = useState(() => { try { return JSON.parse(sessionStorage.getItem('cd')); } catch { return null; } });
  const onAuth = d => { sessionStorage.setItem('cd', JSON.stringify(d)); setSession(d); };
  const logout = () => { sessionStorage.removeItem('cd'); setSession(null); setPage('home'); };
  if (session?.user.role === 'admin') return <Admin user={session.user} token={session.token} logout={logout} />;
  if (session) return <Dashboard user={session.user} token={session.token} logout={logout} />;
  if (page === 'login' || page === 'register') return <Auth mode={page} onAuth={onAuth} go={setPage} />;
  if (page === 'track') return <TrackPage go={setPage} />;
  if (page === 'anon') return <Anon go={setPage} />;
  return <Home go={setPage} />;
}
