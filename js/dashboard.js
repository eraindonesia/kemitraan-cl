/* ----------------------------- Auth ----------------------------- */
function showAuth() {
  $('appShell').hidden = true; $('authScreen').hidden = false; closeModal();
  $('formLogin').hidden = false; $('formReg').hidden = true; $('tabLogin').classList.add('on'); $('tabReg').classList.remove('on');
  const sel = $('rgJenis'); const list = S.master ? S.master.jenis.map(function (j) { return [j.kode, j.nama]; }) : JENIS_FALLBACK;
  sel.innerHTML = '<option value="">Pilih jenis mitra…</option>' + list.map(function (j) { return '<option value="' + esc(j[0]) + '">' + esc(j[1]) + '</option>'; }).join('');
  const c = S.master && S.master.config; if (c && (c.helpdesk_email || c.helpdesk_telp)) $('helpdesk').innerHTML = 'Bantuan: ' + esc(c.helpdesk_email || '') + ' ' + esc(c.helpdesk_telp || '');
}
function showApp() { $('authScreen').hidden = true; $('appShell').hidden = false; applyTheme(); }
function forceLogout(msg) {
  S.token = null; S.me = null; LS.del('sm_tok'); LS.del('sm_snap'); S.det = {}; S.stack = []; S.view = '';
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
function vDashboard() {
  setTitle('Dasbor'); const D = S.daftar; const aksi = D.filter(needsAction);
  const cnt = function (g) { return D.filter(function (p) { return groupOf(p) === g; }).length; };
  const kpis = [
    { t: 'Total pengajuan', v: D.length, ic: 'description', c: 'var(--blue-l)', cc: 'var(--blue)', go: {} },
    { t: 'Sedang berjalan', v: cnt('Berjalan') + cnt('Perlu dilengkapi'), ic: 'autorenew', c: 'var(--teal-l)', cc: 'var(--teal-d)', go: { grup: 'Berjalan' } },
    { t: S.me.peran === 'mitra' ? 'Perlu Anda lengkapi' : 'Perlu tindakan Anda', v: aksi.length, ic: 'pending_actions', c: 'var(--amber-l)', cc: '#a56a06', go: { aksi: 1 } },
    { t: 'Pelaksanaan / selesai', v: cnt('Pelaksanaan') + cnt('Selesai'), ic: 'verified', c: 'var(--green-l)', cc: 'var(--green-d)', go: { tahap: '12' } }
  ];
  const pipe = S.master.stages.map(function (s, i) { const n = D.filter(function (p) { return p.tahap === s.no && FINAL.indexOf(p.status) === -1; }).length; return '<button class="' + (n ? 'has' : 'zero') + '" data-act="goTahap" data-t="' + s.no + '" title="' + esc(s.nama) + '"><b>' + n + '</b><span>' + (i + 1) + '. ' + esc(SHORT[i]) + '</span></button>'; }).join('');
  const kw = {}; D.forEach(function (p) { kw[p.kawasan] = (kw[p.kawasan] || 0) + 1; });
  const kwKeys = Object.keys(kw).sort(function (a, b) { return kw[b] - kw[a]; }); const mx = Math.max(1, kw[kwKeys[0]] || 1);
  const bars = kwKeys.length ? kwKeys.map(function (k) { return '<div class="brow"><span title="' + esc(k) + '">' + esc(k) + '</span><div class="bt"><i style="width:' + (kw[k] / mx * 100) + '%"></i></div><b>' + kw[k] + '</b></div>'; }).join('') : '<div class="empty" style="padding:18px">Belum ada data.</div>';
  const grp = [['Berjalan', 'var(--teal)'], ['Perlu dilengkapi', 'var(--amber)'], ['Pelaksanaan', 'var(--green)'], ['Selesai', 'var(--blue)'], ['Tidak dilanjutkan', 'var(--red)']];
  const tot = Math.max(1, D.length); let off = 0; const R = 52, C = 2 * Math.PI * R;
  const arcs = grp.map(function (g) { const n = cnt(g[0]); const len = n / tot * C; const s = '<circle r="' + R + '" cx="65" cy="65" fill="none" stroke="' + g[1] + '" stroke-width="16" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 65 65)"/>'; off += len; return s; }).join('');
  const leg = grp.map(function (g) { return '<div><i style="background:' + g[1] + '"></i>' + g[0] + ' <b>' + cnt(g[0]) + '</b></div>'; }).join('');
  const act = aksi.slice(0, 6).map(function (p) { return '<div class="it" style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);cursor:pointer" data-act="open" data-id="' + esc(p.id) + '"><div style="flex:1;min-width:0"><div class="t-b" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.judul) + '</div><div class="t-sub">' + esc(p.nomor) + ' · Tahap ' + p.tahap + ' · ' + esc(p.lembaga) + '</div></div>' + chip(p) + '</div>'; }).join('') || '<div class="empty" style="padding:22px">' + mi('task_alt') + 'Tidak ada tindakan tertunda.</div>';
  const tl = S.timeline.slice(0, 8).map(function (r) { const p = pById(r.id_pengajuan); const bad = /Tidak/.test(r.keputusan); return '<div class="it ' + (bad ? 'bad' : '') + '"><b>' + esc(r.keputusan) + '</b> · ' + esc(p ? p.nomor : '') + '<small>' + esc(r.pelaku) + ' · ' + ago(r.waktu) + '</small>' + (r.catatan ? '<div class="note">' + esc(r.catatan) + '</div>' : '') + '</div>'; }).join('') || '<div class="empty" style="padding:18px">Belum ada aktivitas.</div>';
  setView('<div class="ph"><div><h2>Halo, ' + esc(S.me.nama.split(' ')[0]) + '</h2><p>' + esc(S.me.peran_nama) + (S.me.lembaga ? ' · ' + esc(S.me.lembaga) : '') + '</p></div><div class="sp"></div>' +
    ((S.me.peran === 'mitra' || S.me.peran === 'admin') ? '<button class="btn btn-p" data-act="newForm">' + mi('add') + ' Ajukan Kemitraan</button>' : '') + '</div>' +
    '<div class="grid g4" style="margin-bottom:16px">' + kpis.map(function (k) { return '<button class="card kpi" data-act="goDaftar" data-p=\'' + esc(JSON.stringify(k.go)) + '\'><div class="ic" style="background:' + k.c + ';color:' + k.cc + '">' + mi(k.ic) + '</div><div><b>' + k.v + '</b><span>' + esc(k.t) + '</span></div></button>'; }).join('') + '</div>' +
    '<div class="card" style="margin-bottom:16px"><h3>Alur 12 tahap kemitraan</h3><p class="sub">Jumlah pengajuan aktif pada setiap tahap. Klik untuk menyaring.</p><div class="pipe">' + pipe + '</div></div>' +
    '<div class="grid g-main" style="margin-bottom:16px"><div class="card"><h3>' + (S.me.peran === 'mitra' ? 'Perlu Anda lengkapi' : 'Perlu tindakan Anda') + '</h3><p class="sub">Urut berdasarkan pembaruan terbaru.</p>' + act + '</div>' +
    '<div class="card"><h3>Status pengajuan</h3><p class="sub">Komposisi seluruh pengajuan.</p><div class="donut"><svg viewBox="0 0 130 130" role="img" aria-label="Diagram status">' + (D.length ? arcs : '<circle r="52" cx="65" cy="65" fill="none" stroke="var(--line)" stroke-width="16"/>') + '<text x="65" y="70" text-anchor="middle" font-size="22" font-weight="800" fill="currentColor">' + D.length + '</text></svg><div class="leg">' + leg + '</div></div></div></div>' +
    '<div class="grid g-main"><div class="card bars"><h3>Per kawasan konservasi</h3><p class="sub">Jumlah pengajuan.</p>' + bars + '</div><div class="card"><h3>Aktivitas terbaru</h3><p class="sub">Jejak keputusan terakhir.</p><div class="tl">' + tl + '</div></div></div>');
}

/* ----------------------------- Daftar pengajuan ----------------------------- */
function applyParams() {
  const p = S.params; S.f = Object.assign({ q: '', status: '', kawasan: '', tahap: '', sort: 'diubah', dir: -1, page: 1 }, { tahap: p.tahap || '', status: p.grup || '', q: p.q || '' });
}
function listData() {
  const f = S.f; const q = f.q.toLowerCase().trim();
  let a = S.daftar.filter(function (p) {
    if (S.params.aksi && !needsAction(p)) return false;
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
  const title = S.params.aksi ? (S.me.peran === 'mitra' ? 'Perlu Dilengkapi' : 'Perlu Tindakan') : S.params.tahap === '12' ? 'Monitoring & Evaluasi' : (S.me.peran === 'mitra' ? 'Pengajuan Saya' : 'Daftar Pengajuan'); setTitle(title);
  const kaw = S.master.kawasan.map(function (k) { return '<option value="' + esc(k.nama) + '"' + (S.f.kawasan === k.nama ? ' selected' : '') + '>' + esc(k.nama) + '</option>'; }).join('');
  const grups = ['Berjalan', 'Perlu dilengkapi', 'Pelaksanaan', 'Selesai', 'Tidak dilanjutkan'];
  setView('<div class="ph"><div><h2>' + esc(title) + '</h2><p id="listCount"></p></div><div class="sp"></div>' + ((S.me.peran === 'mitra' || S.me.peran === 'admin') ? '<button class="btn btn-p" data-act="newForm">' + mi('add') + ' Ajukan Kemitraan</button>' : '') + '</div>' +
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
