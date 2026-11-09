/* =====================================================================
 * SI-MITRA — Client SPA (tanpa reload/redirect; aman di iframe)
 * Prinsip Instant UX: (1) filter/sort/navigasi 100% lokal,
 * (2) Optimistic UI + localStorage snapshot, (3) server CacheService,
 * (4) satu panggilan batch per layar (boot / detail).
 * ===================================================================== */
'use strict';

const LS = {
  get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const JENIS_FALLBACK = [
  ['kelompok_masyarakat', 'Kelompok Masyarakat'], ['masyarakat_adat', 'Masyarakat Adat'], ['lsm_daerah', 'LSM Provinsi/Kabupaten/Kota'],
  ['lsm_nasional', 'LSM Nasional'], ['lsm_asing', 'LSM Asing'], ['pelaku_usaha', 'Pelaku Usaha / Korporasi'],
  ['penelitian_dn', 'Lembaga Penelitian Dalam Negeri'], ['penelitian_asing', 'Lembaga Penelitian Asing'],
  ['pt_nasional', 'Perguruan Tinggi Nasional'], ['pt_asing', 'Perguruan Tinggi Asing']
];
const SHORT = ['Koordinasi', 'Permohonan', 'Verif. Adm', 'Ruang & RPZ', 'Penilaian', 'Pemaparan', 'Penelaahan', 'Kesepakatan', 'Draft PKS', 'Lapor Gub.', 'TTD PKS', 'Monev'];
const FINAL = ['Tidak dilanjutkan', 'Selesai'];
const NILAI = ['Sesuai', 'Perlu Perbaikan', 'Tidak Sesuai'];

const S = {
  token: null, me: null, master: null, daftar: [], timeline: [], monev: [], notif: [],
  view: '', params: {}, stack: [], det: {}, pending: 0, dirty: false, users: null,
  f: { q: '', status: '', kawasan: '', tahap: '', sort: 'diubah', dir: -1, page: 1 },
  tab: 'ringkasan'
};

/* ----------------------------- util ----------------------------- */
const $ = function (id) { return document.getElementById(id); };
function esc(v) { return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmtD(iso) { if (!iso) return '-'; const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
function fmtDT(iso) { if (!iso) return '-'; const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function rp(n) { if (n === '' || n === null || n === undefined || isNaN(Number(n))) return '-'; return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function ago(iso) { const s = (Date.now() - new Date(iso)) / 1000; if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' menit lalu'; if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; return Math.floor(s / 86400) + ' hari lalu'; }
function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (x) { return x[0]; }).join('').toUpperCase(); }
function words(s) { return String(s || '').trim() ? String(s).trim().split(/\s+/).length : 0; }
function debounce(fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
function isStaff() { return S.me && ['prl', 'uptd', 'kepala_dkp', 'admin'].indexOf(S.me.peran) > -1; }
function mi(n, extra) { return '<span class="mi"' + (extra ? ' style="' + extra + '"' : '') + ' aria-hidden="true">' + n + '</span>'; }
function stageName(n) { const s = S.master && S.master.stages[n - 1]; return s ? s.nama : 'Tahap ' + n; }
function statusClass(p) {
  const s = p.status;
  if (s === 'Draft') return 'c-draft'; if (s === 'Perlu dilengkapi') return 'c-warn'; if (s === 'Tidak dilanjutkan') return 'c-bad';
  if (s === 'Selesai' || s === 'Pelaksanaan') return 'c-ok'; return 'c-run';
}
function chip(p) { return '<span class="chip ' + statusClass(p) + '">' + esc(p.status) + '</span>'; }
function jenisNama(k) { const j = (S.master && S.master.jenis || []).filter(function (x) { return x.kode === k; })[0]; return j ? j.nama : (k || '-'); }

/* ----------------------------- API: lihat js/api.js ----------------------------- */
/* Antrean tulis latar belakang (berurutan) + indikator sinkron */
let qChain = Promise.resolve();
function bg(label, fn, onFail) {
  S.pending++; syncUi();
  qChain = qChain.then(fn).catch(function (e) {
    if (e && e.code === 'AUTH') return;
    toast('bad', label + ': ' + (e && e.message ? e.message : 'gagal'));
    if (onFail) { try { onFail(e); } catch (x) {} }
  }).then(function () { S.pending--; syncUi(); persist(); });
}
function syncUi() {
  const el = $('sync');
  if (!navigator.onLine) { el.hidden = false; el.className = 'sync off'; el.innerHTML = mi('cloud_off', 'font-size:16px') + ' Offline — perubahan akan gagal tersimpan'; return; }
  if (S.pending > 0) { el.hidden = false; el.className = 'sync'; el.innerHTML = '<span class="spin"></span> Menyimpan…'; } else el.hidden = true;
}
window.addEventListener('online', syncUi); window.addEventListener('offline', syncUi);

function persist() {
  if (!S.me) return;
  const clean = S.daftar.filter(function (p) { return !p._pending; });
  LS.set('sm_snap', { me: S.me, master: S.master, daftar: clean, timeline: S.timeline, monev: S.monev, notif: S.notif, t: Date.now() });
}
function hydrate(d) {
  S.me = d.me; S.master = d.master || S.master; S.daftar = d.daftar || []; S.timeline = d.timeline || []; S.monev = d.monev || []; S.notif = d.notif || [];
}

/* ----------------------------- UI primitif ----------------------------- */
function toast(kind, msg) {
  const t = document.createElement('div'); t.className = 'toast ' + (kind || '');
  t.innerHTML = mi(kind === 'bad' ? 'error' : kind === 'ok' ? 'check_circle' : 'info') + '<span>' + esc(msg) + '</span><button class="x" aria-label="Tutup">' + mi('close', 'font-size:16px') + '</button>';
  t.querySelector('.x').onclick = function () { t.remove(); };
  $('toasts').appendChild(t); setTimeout(function () { t.remove(); }, kind === 'bad' ? 6500 : 3200);
}
function closeModal() { $('modalRoot').innerHTML = ''; document.removeEventListener('keydown', escClose); }
function escClose(e) { if (e.key === 'Escape') closeModal(); }
/** modal({title, body, ok, danger, hideCancel, onOk(root) -> Promise|void}) */
function modal(o) {
  const root = $('modalRoot');
  root.innerHTML = '<div class="modal-bg" data-act="modalBg"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><h3>' + esc(o.title) + '</h3>' +
    (o.sub ? '<p class="sub" style="color:var(--tx-3);margin-bottom:10px">' + o.sub + '</p>' : '') + '<div id="mBody">' + (o.body || '') + '</div><div id="mErr" class="errtxt" role="alert" style="margin-top:8px"></div>' +
    '<div class="btns">' + (o.hideCancel ? '' : '<button class="btn btn-o" data-act="closeModal">Batal</button>') +
    (o.ok ? '<button class="btn ' + (o.danger ? 'btn-d' : 'btn-p') + '" id="mOk">' + esc(o.ok) + '</button>' : '<button class="btn btn-o" data-act="closeModal">Tutup</button>') + '</div></div></div>';
  document.addEventListener('keydown', escClose);
  const f = root.querySelector('input,select,textarea'); if (f) setTimeout(function () { f.focus(); }, 30);
  if (o.ok) $('mOk').onclick = function () {
    const btn = $('mOk'); const r = o.onOk(root);
    if (r && r.then) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; r.then(function (ok) { if (ok !== false) closeModal(); else { btn.disabled = false; btn.textContent = o.ok; } }).catch(function (e) { $('mErr').textContent = e.message; btn.disabled = false; btn.textContent = o.ok; }); }
  };
  return root;
}
function loadingBtn(btn, on, label) { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; } else { btn.disabled = false; btn.innerHTML = btn.dataset.l || label || btn.innerHTML; } }

/* ----------------------------- Tema ----------------------------- */
function applyTheme(t) {
  t = t || LS.get('sm_theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t); LS.set('sm_theme', t);
  const ic = $('themeIc'); if (ic) ic.textContent = t === 'dark' ? 'light_mode' : 'dark_mode';
}

/* ----------------------------- Router SPA ----------------------------- */
function navigateTo(view, params, opts) {
  if (S.view && !(opts && opts.replace) && S.view !== view) S.stack.push({ view: S.view, params: S.params });
  if (S.stack.length > 30) S.stack.shift();
  S.view = view; S.params = params || {}; S.dirty = false;
  closeNav(); closePop(); renderNav(); renderView();
  const v = $('view'); if (v) { v.scrollTop = 0; window.scrollTo(0, 0); }
}
function goBack(fallback) { const p = S.stack.pop(); if (p) { S.view = p.view; S.params = p.params; S.dirty = false; renderNav(); renderView(); window.scrollTo(0, 0); } else navigateTo(fallback || 'dashboard', {}, { replace: true }); }
function openNav() { $('sidebar').classList.add('open'); $('scrim').classList.add('show'); }
function closeNav() { $('sidebar').classList.remove('open'); $('scrim').classList.remove('show'); }
function closePop() { const p = $('notifPop'); if (p) p.hidden = true; }

function navItems() {
  const r = S.me.peran; const a = [{ id: 'dashboard', ic: 'dashboard', t: 'Dasbor' }];
  a.push({ id: 'daftar', ic: 'folder_open', t: r === 'mitra' ? 'Pengajuan Saya' : 'Daftar Pengajuan', p: {} });
  if (r === 'mitra' || r === 'admin') a.push({ id: 'form', ic: 'add_circle', t: 'Ajukan Kemitraan' });
  if (r !== 'mitra' && r !== 'admin') a.push({ id: 'daftar', ic: 'pending_actions', t: 'Perlu Tindakan', p: { aksi: 1 }, badge: S.daftar.filter(needsAction).length });
  if (r === 'mitra') a.push({ id: 'daftar', ic: 'pending_actions', t: 'Perlu Dilengkapi', p: { aksi: 1 }, badge: S.daftar.filter(needsAction).length });
  a.push({ id: 'daftar', ic: 'monitoring', t: 'Monitoring & Evaluasi', p: { tahap: '12' } });
  if (r === 'admin') { a.push({ grp: 'Administrasi' }); a.push({ id: 'users', ic: 'group', t: 'Pengguna' }); a.push({ id: 'master', ic: 'tune', t: 'Data Master' }); }
  a.push({ grp: 'Akun' }); a.push({ id: 'akun', ic: 'manage_accounts', t: 'Pengaturan Akun' });
  return a;
}
function navActive(it) {
  if (it.grp) return false; if (it.id !== S.view) return false;
  if (it.id === 'daftar') { const p = it.p || {}; return (!!p.aksi === !!S.params.aksi) && ((p.tahap || '') === (S.params.tahap || '')); }
  return true;
}
function renderNav() {
  $('nav').innerHTML = navItems().map(function (it, i) {
    if (it.grp) return '<div class="grp">' + esc(it.grp) + '</div>';
    return '<button class="' + (navActive(it) ? 'on' : '') + '" data-act="nav" data-i="' + i + '">' + mi(it.ic) + '<span>' + esc(it.t) + '</span>' + (it.badge ? '<span class="badge">' + it.badge + '</span>' : '') + '</button>';
  }).join('');
  $('sbAv').textContent = initials(S.me.nama); $('sbName').textContent = S.me.nama; $('sbRole').textContent = S.me.peran_nama;
  const unread = S.notif.filter(function (n) { return !(n.dibaca === true || n.dibaca === 'TRUE'); }).length;
  const d = $('notifDot'); d.hidden = !unread; d.textContent = unread > 9 ? '9+' : unread;
}
function setTitle(t) { $('pageTitle').textContent = t; document.title = t + ' · SI-MITRA'; }
function renderView() {
  const V = { dashboard: vDashboard, daftar: vDaftar, form: vForm, detail: vDetail, users: vUsers, master: vMaster, akun: vAkun };
  (V[S.view] || vDashboard)();
}
function setView(html) { $('view').innerHTML = html; }

/* ----------------------------- aturan tahap ----------------------------- */
function needsAction(p) {
  if (FINAL.indexOf(p.status) > -1 || p._pending) return false; const r = S.me.peran;
  if (r === 'mitra') return p.tahap === 1 && (p.status === 'Draft' || p.status === 'Perlu dilengkapi');
  if (r === 'admin' || p.tahap === 12) return false;
  return (S.master.trans[p.tahap] || []).some(function (t) { return t.roles.indexOf(r) > -1 && (!t.onlyStatus || t.onlyStatus === p.status) && !t.owner; });
}
function opsiFor(p) {
  if (FINAL.indexOf(p.status) > -1 || p._pending) return [];
  return (S.master.trans[p.tahap] || []).filter(function (t) {
    if (t.roles.indexOf(S.me.peran) === -1) return false;
    if (t.onlyStatus && t.onlyStatus !== p.status) return false;
    if (p.tahap === 1 && !t.onlyStatus && p.status === 'Perlu dilengkapi') return false;
    if (t.owner && S.me.peran === 'mitra' && p.id_user !== S.me.id) return false;
    return true;
  });
}
function replaceP(np) { const i = S.daftar.findIndex(function (x) { return x.id === np.id; }); if (i > -1) S.daftar[i] = np; else S.daftar.unshift(np); }
function pById(id) { return S.daftar.filter(function (p) { return p.id === id; })[0]; }
