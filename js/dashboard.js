/* ----------------------------- Auth ----------------------------- */
function showAuth() {
  $('appShell').hidden = true; $('authScreen').hidden = false; closeModal();
  $('formLogin').hidden = false; $('formReg').hidden = true; $('tabLogin').classList.add('on'); $('tabReg').classList.remove('on');
  const sel = $('rgJenis'); const list = S.master ? S.master.jenis.map(function (j) { return [j.kode, j.nama]; }) : JENIS_FALLBACK;
  sel.innerHTML = '<option value="">Pilih jenis mitra…</option>' + list.map(function (j) { return '<option value="' + esc(j[0]) + '">' + esc(j[1]) + '</option>'; }).join('');
  const c = S.master && S.master.config; if (c && (c.helpdesk_email || c.helpdesk_telp)) $('helpdesk').innerHTML = 'Bantuan: ' + esc(c.helpdesk_email || '') + ' ' + esc(c.helpdesk_telp || '');
  applyAuthMode();
}
/* ----------------------------- Login Google (Google Identity Services) ----------------------------- */
function authCfg() { const c = (S.master && S.master.config) || {}; return { gid: c.google_client_id || '', pw: c.password_login !== false }; }
function googleOnlyUI() { const a = authCfg(); return !!a.gid && !a.pw; }
function applyAuthMode() {
  const a = authCfg(); const g = !!a.gid; const seg = document.querySelector('.auth-box .seg');
  $('googleBox').hidden = !g; $('formProfil').hidden = true; $('gErr').textContent = '';
  if (!g) { seg.hidden = false; return; }
  seg.hidden = true; $('formReg').hidden = true; $('formLogin').hidden = !a.pw; $('gOr').hidden = !a.pw;
  const sel = $('pfJenis'); const list = S.master ? S.master.jenis.map(function (j) { return [j.kode, j.nama]; }) : JENIS_FALLBACK;
  sel.innerHTML = '<option value="">Pilih jenis mitra…</option>' + list.map(function (j) { return '<option value="' + esc(j[0]) + '">' + esc(j[1]) + '</option>'; }).join('');
  gButton($('gBtn'), onGoogleLogin, { text: 'signin_with', width: 340 });
}
function loadGIS(cb) {
  if (window.google && google.accounts && google.accounts.id) return cb();
  S._gisQ = S._gisQ || []; S._gisQ.push(cb); if (S._gisLoading) return; S._gisLoading = true;
  const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.defer = true;
  sc.onload = function () { S._gisLoading = false; S._gisQ.splice(0).forEach(function (f) { f(); }); };
  sc.onerror = function () { S._gisLoading = false; S._gisQ = []; const e = $('gErr'); if (e) e.textContent = 'Layanan Google tidak dapat dimuat. Periksa koneksi internet Anda lalu muat ulang halaman.'; const b = $('gBtn'); if (b) b.innerHTML = '<button class="btn btn-o" type="button" data-act="gRetry">Coba lagi</button>'; };
  document.head.appendChild(sc);
}
function gButton(el, cb, opt) {
  if (!el) return;
  loadGIS(function () {
    const gid = authCfg().gid; if (!gid) return;
    if (S._gInit !== gid) { google.accounts.id.initialize({ client_id: gid, callback: function (r) { if (S._gcb && r && r.credential) S._gcb(r.credential); }, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true }); S._gInit = gid; }
    S._gcb = cb; el.innerHTML = '';
    google.accounts.id.renderButton(el, Object.assign({ theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', logo_alignment: 'left', width: 340 }, opt || {}));
  });
}
function onGoogleLogin(cred) {
  $('gErr').textContent = ''; const b = $('gBtn'); b.style.opacity = '.5'; b.style.pointerEvents = 'none';
  api('login_google', { credential: cred }).then(function (r) { if (r.perlu_daftar) showProfil(r, cred); else afterAuth(r); })
    .catch(function (er) { $('gErr').textContent = er.message; }).then(function () { b.style.opacity = ''; b.style.pointerEvents = ''; });
}
function showProfil(r, cred) {
  S._gcredReg = cred; $('googleBox').hidden = true; $('formLogin').hidden = true; $('formProfil').hidden = false; $('pfErr').textContent = '';
  $('pfEmail').value = r.email; $('pfNama').value = r.nama || ''; $('pfLembaga').focus();
}
/** Konfirmasi pejabat: kata sandi (mode lama) atau verifikasi ulang dengan akun Google (mode Google). */
function approverField(id, hint) {
  if (googleOnlyUI()) return '<div class="fld"><label>Verifikasi dengan akun Google <i>*</i></label><div id="' + id + 'G" class="gbtn"></div><input type="hidden" id="' + id + '"><div class="hint" id="' + id + 'S">Klik tombol Google dan pilih akun <b>' + esc(S.me.email) + '</b> untuk memverifikasi bahwa Anda penanda tangan.</div></div>';
  return '<div class="fld"><label>Kata sandi Anda <i>*</i></label><input type="password" class="in" id="' + id + '" autocomplete="current-password">' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
}
function approverInit(id) {
  if (!googleOnlyUI()) return;
  gButton($(id + 'G'), function (cred) { $(id).value = cred; $(id + 'S').innerHTML = '<span style="color:var(--green);font-weight:600">✓ Terverifikasi.</span> Lanjutkan dengan tombol di bawah (berlaku 10 menit).'; }, { text: 'continue_with', width: 300 });
}
function approverMsg() { return googleOnlyUI() ? 'Verifikasi dengan akun Google wajib dilakukan.' : 'Kata sandi wajib diisi.'; }
function showApp() { $('authScreen').hidden = true; $('appShell').hidden = false; applyTheme(); }
function forceLogout(msg) {
  S.token = null; S.me = null; S.peta = null; S.dok = null; S._sig = null; LS.del('sm_tok'); LS.del('sm_snap'); LS.del('sm_peta'); LS.del('sm_form'); S.det = {}; S.dash = { periode: 'all', kawasan: '' }; S.params = {}; S.stack = []; S.view = '';
  showAuth(); if (msg) $('lgErr').textContent = msg;
}
function afterAuth(r) {
  S.token = r.token; LS.set('sm_tok', r.token); hydrate(r); persist(); showApp(); S.stack = []; S.view = '';
  navigateTo('dashboard', {}, { replace: true });
}
function pwScore(p) { let s = 0; if (p.length >= 8) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++; return s; }
function bindAuth() {
  $('formLogin').addEventListener('submit', function (e) {
    e.preventDefault(); $('lgErr').textContent = '';
    const em = $('lgEmail').value.trim(), pw = $('lgPw').value;
    if (!em || !pw) { $('lgErr').textContent = 'Email dan kata sandi wajib diisi.'; return; }
    const b = $('btnLogin'); loadingBtn(b, true);
    api('login', { email: em, password: pw }).then(afterAuth).catch(function (er) { $('lgErr').textContent = er.message; }).then(function () { loadingBtn(b, false); });
  });
  $('formProfil').addEventListener('submit', function (e) {
    e.preventDefault(); $('pfErr').textContent = '';
    const d = { credential: S._gcredReg, lembaga: $('pfLembaga').value, jenis_mitra: $('pfJenis').value, nama: $('pfNama').value, jabatan: $('pfJab').value, telepon: $('pfTelp').value };
    if (!d.lembaga.trim() || !d.nama.trim() || !d.jenis_mitra || !d.telepon.trim()) { $('pfErr').textContent = 'Lengkapi semua kolom bertanda *.'; return; }
    const b = $('btnProfil'); loadingBtn(b, true);
    api('register_google', d).then(afterAuth).catch(function (er) { $('pfErr').textContent = er.message; }).then(function () { loadingBtn(b, false); });
  });
  $('formReg').addEventListener('submit', function (e) {
    e.preventDefault(); $('rgErr').textContent = '';
    const d = { lembaga: $('rgLembaga').value, jenis_mitra: $('rgJenis').value, nama: $('rgNama').value, jabatan: $('rgJab').value, email: $('rgEmail').value, telepon: $('rgTelp').value, password: $('rgPw').value };
    if (!d.lembaga.trim() || !d.nama.trim() || !d.jenis_mitra || !d.email.trim() || !d.telepon.trim()) { $('rgErr').textContent = 'Lengkapi semua kolom bertanda *.'; return; }
    if (d.password.length < 8) { $('rgErr').textContent = 'Kata sandi minimal 8 karakter.'; return; }
    const b = $('btnReg'); loadingBtn(b, true);
    api('register', d).then(afterAuth).catch(function (er) { $('rgErr').textContent = er.message; }).then(function () { loadingBtn(b, false); });
  });
  $('rgPw').addEventListener('input', function () {
    const s = pwScore(this.value); const m = $('pwMeter'); m.style.width = (s * 25) + '%'; m.style.background = ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--teal)', 'var(--green)'][s];
    $('pwHint').textContent = ['Terlalu lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][s];
  });
}

/* ----------------------------- Dashboard (lokal 100%) ----------------------------- */
function groupOf(p) {
  if (p.status === 'Tidak dilanjutkan') return 'Tidak dilanjutkan'; if (p.status === 'Selesai') return 'Selesai';
  if (p.status === 'Perlu dilengkapi') return 'Perlu dilengkapi'; if (p.tahap === 12) return 'Pelaksanaan'; return 'Berjalan';
}

/* ----------------------------- Daftar pengajuan ----------------------------- */
function applyParams() {
  const p = S.params; S.f = Object.assign({ q: '', status: '', kawasan: '', tahap: '', sort: 'diubah', dir: -1, page: 1 }, { tahap: p.tahap || '', status: p.grup || '', q: p.q || '' });
}
function listData() {
  const f = S.f; const q = f.q.toLowerCase().trim();
  let a = S.daftar.filter(function (p) {
    if (S.params.aksi && !needsAction(p)) return false;
    if (S.params.t1 && (p.tahap < S.params.t1 || p.tahap > S.params.t2)) return false;
    if (q && (p.nomor + ' ' + p.judul + ' ' + p.lembaga + ' ' + p.kawasan).toLowerCase().indexOf(q) === -1) return false;
    if (f.status && groupOf(p) !== f.status) return false;
    if (f.kawasan && p.kawasan !== f.kawasan) return false;
    if (f.tahap && String(p.tahap) !== String(f.tahap)) return false;
    return true;
  });
  a.sort(function (x, y) { const k = f.sort; let vx = x[k], vy = y[k]; if (k === 'tahap' || k === 'biaya') { vx = Number(vx) || 0; vy = Number(vy) || 0; } else { vx = String(vx || '').toLowerCase(); vy = String(vy || '').toLowerCase(); } return (vx < vy ? -1 : vx > vy ? 1 : 0) * f.dir; });
  return a;
}
function vDaftar() {
  if (!S._keepF) applyParams(); S._keepF = false;
  const title = S.params.aksi ? (S.me.peran === 'mitra' ? 'Perlu Dilengkapi' : 'Perlu Tindakan') : S.params.t1 ? 'Telaah & Verifikasi' : S.params.tahap === '12' ? 'Monitoring & Evaluasi' : (S.me.peran === 'mitra' ? 'Pengajuan Saya' : 'Daftar Pengajuan'); setTitle(title);
  const kaw = S.master.kawasan.map(function (k) { return '<option value="' + esc(k.nama) + '"' + (S.f.kawasan === k.nama ? ' selected' : '') + '>' + esc(k.nama) + '</option>'; }).join('');
  const grups = ['Berjalan', 'Perlu dilengkapi', 'Pelaksanaan', 'Selesai', 'Tidak dilanjutkan'];
  setView('<div class="ph"><div><h2>' + esc(title) + '</h2><p id="listCount"></p></div><div class="sp"></div>' + ((S.me.peran === 'mitra') ? '<button class="btn btn-p" data-act="newForm">' + mi('add') + ' Ajukan Kemitraan</button>' : '') + '</div>' +
    '<div class="card" style="margin-bottom:14px;padding:14px"><div class="filters">' +
    '<input id="fQ" class="in" type="search" placeholder="Cari nomor, judul, lembaga…" aria-label="Cari" value="' + esc(S.f.q) + '">' +
    '<select id="fS" class="in" aria-label="Status"><option value="">Semua status</option>' + grups.map(function (g) { return '<option' + (S.f.status === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select>' +
    '<select id="fK" class="in" aria-label="Kawasan"><option value="">Semua kawasan</option>' + kaw + '</select>' +
    '<select id="fT" class="in" aria-label="Tahap"><option value="">Semua tahap</option>' + S.master.stages.map(function (s) { return '<option value="' + s.no + '"' + (String(S.f.tahap) === String(s.no) ? ' selected' : '') + '>' + s.no + '. ' + esc(SHORT[s.no - 1]) + '</option>'; }).join('') + '</select></div></div>' +
    '<div id="listBody"></div>');
  $('fQ').addEventListener('input', debounce(function () { S.f.q = this.value; S.f.page = 1; renderList(); }, 90));
  $('fS').onchange = function () { S.f.status = this.value; S.f.page = 1; renderList(); };
  $('fK').onchange = function () { S.f.kawasan = this.value; S.f.page = 1; renderList(); };
  $('fT').onchange = function () { S.f.tahap = this.value; S.f.page = 1; renderList(); };
  renderList();
}
function renderList() {
  const a = listData(); const per = 10; const pages = Math.max(1, Math.ceil(a.length / per)); if (S.f.page > pages) S.f.page = pages;
  const rows = a.slice((S.f.page - 1) * per, S.f.page * per); const cnt = $('listCount'); if (cnt) cnt.textContent = a.length + ' pengajuan ditemukan';
  const th = function (k, t) { return '<th class="sortable" data-act="sort" data-k="' + k + '">' + t + (S.f.sort === k ? (S.f.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; };
  const open = function (p) { return p._pending ? '' : ' data-act="open" data-id="' + esc(p.id) + '"'; };
  const body = rows.map(function (p) {
    return '<tr' + open(p) + (p._pending ? ' style="opacity:.6;cursor:wait"' : '') + '><td><div class="t-b">' + esc(p.nomor) + '</div><div class="t-sub">' + fmtD(p.dibuat) + '</div></td><td><div class="t-b">' + esc(p.judul) + '</div><div class="t-sub">' + esc(p.lembaga) + '</div></td><td>' + esc(p.kawasan) + '</td>' +
      '<td><div class="mini-prog"><div class="bar"><i style="width:' + (p.tahap / 12 * 100) + '%"></i></div><span class="t-sub">' + p.tahap + '/12</span></div></td><td>' + (p._pending ? '<span class="chip c-draft"><span class="spin" style="border-color:var(--tx-3);border-top-color:transparent"></span> Menyimpan</span>' : chip(p)) + '</td><td class="t-sub">' + ago(p.diubah) + '</td></tr>';
  }).join('');
  const cards = rows.map(function (p) { return '<div class="mcard"' + open(p) + '><div class="top"><b>' + esc(p.nomor) + '</b>' + chip(p) + '</div><div class="t-b">' + esc(p.judul) + '</div><div class="t-sub">' + esc(p.lembaga) + ' · ' + esc(p.kawasan) + '</div><div class="mini-prog" style="margin-top:8px"><div class="bar"><i style="width:' + (p.tahap / 12 * 100) + '%"></i></div><span class="t-sub">Tahap ' + p.tahap + '/12</span></div></div>'; }).join('');
  const empty = '<div class="card empty">' + mi('folder_off') + 'Tidak ada pengajuan yang cocok.</div>';
  let pg = ''; for (let i = 1; i <= pages && i <= 12; i++) pg += '<button class="' + (i === S.f.page ? 'on' : '') + '" data-act="page" data-n="' + i + '">' + i + '</button>';
  $('listBody').innerHTML = !a.length ? empty : '<div class="tbl-wrap"><table><thead><tr>' + th('nomor', 'No. Pengajuan') + th('judul', 'Program / Lembaga') + th('kawasan', 'Kawasan') + th('tahap', 'Progres') + th('status', 'Status') + th('diubah', 'Diperbarui') + '</tr></thead><tbody>' + body + '</tbody></table></div><div class="cards-m">' + cards + '</div>' +
    '<div class="pager"><span>Menampilkan ' + ((S.f.page - 1) * per + 1) + '–' + Math.min(S.f.page * per, a.length) + ' dari ' + a.length + '</span><div class="pg">' + pg + '</div></div>';
}
