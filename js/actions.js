/* ----------------------------- Aksi tahap (optimistic) ----------------------------- */
function curP() { return pById(S.params.id); }
function precheckMaju(p, t) {
  const d = detData(); if (!d) return '';
  if (t.k.indexOf('Kirim') === 0) { const ms = dokMissing(p, d); if (ms.length) { S.tab = 'dokumen'; S.dokSel = { id: p.id, i: Math.max(0, dokItems(p).items.indexOf(ms[0])) }; return 'Dokumen persyaratan belum lengkap (' + ms.length + ' belum diunggah): ' + ms.slice(0, 2).join('; ') + (ms.length > 2 ? ', dst.' : '') + '.'; } }
  if (t.k === 'Lengkap') { const items = S.master.persyaratan[p.jenis_mitra] || []; const ok = items.every(function (i) { return d.checklist.some(function (c) { return c.item === i && c.status === 'Sesuai'; }); }); if (!ok) { S.tab = 'checklist'; return 'Checklist (Lampiran III) belum seluruhnya "Sesuai". Simpan checklist lengkap terlebih dahulu.'; } }
  return '';
}
function applyMaju(p, t, catatan, pw) {
  const before = Object.assign({}, p); const now = new Date().toISOString();
  const upd = Object.assign({}, p, { tahap: t.to, status: t.status, diubah: now, diubah_oleh: S.me.nama });
  const rw = { id: 'tmp', id_pengajuan: p.id, dari: p.tahap, ke: t.to, pelaku: S.me.nama, peran: S.me.peran, keputusan: t.k, catatan: catatan || '', waktu: now };
  const finish = function (r) { replaceP(r.pengajuan); delete S.det[p.id]; if (S.view === 'detail' && S.params.id === p.id) { renderDetailBody(); loadDetail(p.id, true); } renderNav(); };
  if (t.needPass) {
    return api('maju', { id: p.id, keputusan: t.k, catatan: catatan, password: pw }).then(function (r) { finish(r); toast('ok', 'Tahap diproses: ' + r.pengajuan.status); persist(); });
  }
  replaceP(upd); S.timeline.unshift(rw); const c = S.det[p.id]; if (c && c.d) { c.d.riwayat.unshift(rw); c.d.pengajuan = upd; }
  S.tab = 'ringkasan'; renderDetailBody(); renderNav(); toast('ok', 'Berhasil: ' + t.k + ' → ' + t.status);
  bg('Proses tahap', function () { return api('maju', { id: p.id, keputusan: t.k, catatan: catatan }).then(finish); }, function () {
    replaceP(before); S.timeline = S.timeline.filter(function (x) { return x !== rw; }); delete S.det[p.id]; if (S.view === 'detail' && S.params.id === p.id) { renderDetailBody(); loadDetail(p.id, true); } renderNav();
  });
}
function openMaju(p, t) {
  const err = precheckMaju(p, t); if (err) { toast('bad', err); renderDetailBody(); return; }
  const body = '<div class="fld"><label>Catatan' + (t.needCatatan ? ' <i>*</i>' : ' (opsional)') + '</label><textarea class="in" id="mjCat" placeholder="' + (t.needCatatan ? 'Wajib diisi, mis. dokumen yang perlu dilengkapi' : 'Tambahkan catatan keputusan') + '"></textarea></div>' +
    (t.needPass ? approverField('mjPw', 'Persetujuan pejabat memerlukan verifikasi kata sandi.') : '') +
    (t.terminal ? '<div class="callout bad">' + mi('warning') + '<span>Keputusan ini mengakhiri proses dan tidak dapat dibatalkan.</span></div>' : '');
  modal({ title: t.k, sub: 'Tahap ' + p.tahap + ' · ' + esc(stageName(p.tahap)) + ' → <b>' + esc(t.status) + '</b>', body: body, ok: 'Konfirmasi', danger: !!t.terminal, onOk: function () {
    const cat = $('mjCat').value.trim(); const pw = t.needPass ? $('mjPw').value : '';
    if (t.needCatatan && !cat) { $('mErr').textContent = 'Catatan wajib diisi.'; return false; }
    if (t.needPass && !pw) { $('mErr').textContent = approverMsg(); return false; }
    if (t.needPass) return applyMaju(p, t, cat, pw);
    closeModal(); applyMaju(p, t, cat);
  } });
  if (t.needPass) approverInit('mjPw');
}

/* ----------------------------- Simpan instrumen (optimistic) ----------------------------- */
function ensureDet() { const d = detData(); if (!d) return null; return d; }
function saveChecklist() {
  const p = curP(), d = ensureDet(); if (!d) return; const items = S.master.persyaratan[p.jenis_mitra] || []; const out = [];
  items.forEach(function (it, i) { const s = document.querySelector('[data-ck="s"][data-i="' + i + '"]'), c = document.querySelector('[data-ck="c"][data-i="' + i + '"]'); if (s && s.value) out.push({ item: it, status: s.value, catatan: c ? c.value : '' }); });
  if (!out.length) { toast('bad', 'Belum ada nilai yang dipilih.'); return; }
  const before = d.checklist; d.checklist = out.map(function (o) { return Object.assign({ pemeriksa: S.me.nama }, o); }); S.dirty = false; renderDetailBody(); toast('ok', 'Checklist disimpan.');
  bg('Simpan checklist', function () { return api('checklist_simpan', { id: p.id, items: out }).then(function (r) { d.checklist = r; }); }, function () { d.checklist = before; S.dirty = false; renderDetailBody(); });
}
function saveTelaahProgram() {
  const p = curP(), d = ensureDet(); if (!d) return; const data = {};
  S.master.aspek.forEach(function (a) { const s = document.querySelector('[data-tp="s"][data-a="' + a + '"]'), c = document.querySelector('[data-tp="c"][data-a="' + a + '"]'); data[a] = { status: s ? s.value : '', catatan: c ? c.value : '' }; });
  const rek = $('tpRek').value; const before = d.telaah_program; d.telaah_program = { data: data, rekomendasi: rek, penelaah: S.me.nama }; S.dirty = false; renderDetailBody(); toast('ok', 'Telaah program disimpan.');
  bg('Simpan telaah', function () { return api('telaah_simpan', { id: p.id, tipe: 'program', data: data, rekomendasi: rek }); }, function () { d.telaah_program = before; renderDetailBody(); });
}
function saveTelaahBiaya() {
  const p = curP(), d = ensureDet(); if (!d) return;
  const v = { id: p.id, tipe: 'pembiayaan', rencana_biaya: $('tbR').value, sumber_pembiayaan: $('tbS').value, porsi_mitra: $('tbM').value, porsi_dkp: $('tbD').value, porsi_lain: $('tbL').value, rekomendasi: $('tbRek').value };
  const before = d.telaah_pembiayaan; d.telaah_pembiayaan = Object.assign({ penelaah: S.me.nama }, v); S.dirty = false; renderDetailBody(); toast('ok', 'Telaah pembiayaan disimpan.');
  bg('Simpan telaah pembiayaan', function () { return api('telaah_simpan', v); }, function () { d.telaah_pembiayaan = before; renderDetailBody(); });
}
function saveMonev() {
  const p = curP(), d = ensureDet(); if (!d) return; const per = $('mvP').value.trim(); if (!per) { toast('bad', 'Periode wajib diisi.'); return; }
  const cap = Number($('mvC').value || 0); if (isNaN(cap) || cap < 0 || cap > 100) { toast('bad', 'Capaian harus 0–100.'); return; }
  const v = { id: p.id, periode: per, target: $('mvT').value, capaian_persen: cap, realisasi_pembiayaan: $('mvR').value, kendala: $('mvK').value, rekomendasi: $('mvRek').value };
  const row = Object.assign({ id: 'tmp', id_pengajuan: p.id, pelapor: S.me.nama, dibuat: new Date().toISOString() }, v); d.monev.unshift(row); S.monev.unshift(row); renderDetailBody(); toast('ok', 'Laporan monev terkirim.');
  bg('Kirim monev', function () { return api('monev_simpan', v).then(function (r) { Object.assign(row, r); }); }, function () { d.monev = d.monev.filter(function (x) { return x !== row; }); S.monev = S.monev.filter(function (x) { return x !== row; }); renderDetailBody(); });
}
function reloadDetailSoon(id) { delete S.det[id]; if (S.view === 'detail' && S.params.id === id) loadDetail(id, true); }
function saveBA(btn, j) {
  const p = curP(); const g = function (k) { const e = document.querySelector('[data-ba="' + j + '"][data-k="' + k + '"]'); return e ? e.value : ''; };
  loadingBtn(btn, true); api('ba_simpan', { id: p.id, jenis: j, tanggal: g('tanggal'), peserta: g('peserta'), kesimpulan: g('kesimpulan') }).then(function () { toast('ok', 'Berita acara disimpan.'); S.dirty = false; reloadDetailSoon(p.id); }).catch(function (e) { toast('bad', e.message); loadingBtn(btn, false); });
}
function sahkanBA(id) {
  modal({ title: 'Sahkan Berita Acara', sub: 'Setelah disahkan, isi dikunci.', body: approverField('shPw'), ok: 'Sahkan', onOk: function () {
    const pw = $('shPw').value; if (!pw) { $('mErr').textContent = approverMsg(); return false; }
    return api('ba_sahkan', { id_ba: id, password: pw }).then(function () { toast('ok', 'Berita acara disahkan.'); reloadDetailSoon(S.params.id); });
  } });
  approverInit('shPw');
}
function savePKS(btn) {
  const p = curP(); const v = { id: p.id }; const m = { para_pihak: 'pkPihak', ruang_lingkup: 'pkRuang', masa_berlaku: 'pkMasa', tgl_lapor_gubernur: 'pkLapor', bukti_lapor: 'pkBukti' };
  Object.keys(m).forEach(function (k) { const e = $(m[k]); if (e) v[k] = e.value; });
  loadingBtn(btn, true); api('pks_simpan', v).then(function () { toast('ok', 'PKS disimpan.'); S.dirty = false; reloadDetailSoon(p.id); }).catch(function (e) { toast('bad', e.message); loadingBtn(btn, false); });
}

/* ----------------------------- Berkas ----------------------------- */
function uploadFile(inp) {
  const f = inp.files && inp.files[0]; if (!f) return; const p = curP(); const item = inp.dataset.item;
  const ext = f.name.split('.').pop().toLowerCase(); if (['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx'].indexOf(ext) === -1) { toast('bad', 'Tipe berkas tidak diizinkan.'); inp.value = ''; return; }
  if (f.size > 8 * 1024 * 1024) { toast('bad', 'Ukuran berkas melebihi 8 MB.'); inp.value = ''; return; }
  const rd = new FileReader(); toast('', 'Mengunggah ' + f.name + '…');
  rd.onload = function () {
    const b64 = String(rd.result).split(',')[1];
    bg('Unggah berkas', function () { return api('unggah', { id: p.id, item: item, nama: f.name, base64: b64 }).then(function (b) { const c = S.det[p.id]; if (c && c.d) c.d.berkas.push(b); toast('ok', 'Berkas terunggah.'); if (S.view === 'detail' && S.params.id === p.id) renderDetailBody(); }); });
  };
  rd.onerror = function () { toast('bad', 'Gagal membaca berkas.'); }; rd.readAsDataURL(f); inp.value = '';
}
function downloadFile(id) {
  toast('', 'Menyiapkan berkas…');
  api('berkas_ambil', { id_berkas: id }).then(function (r) {
    const bin = atob(r.base64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: r.mime })); const a = document.createElement('a'); a.href = url; a.download = r.nama; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }).catch(function (e) { toast('bad', e.message); });
}
function deleteFile(id) {
  modal({ title: 'Hapus berkas?', body: '<p>Berkas akan dipindahkan ke tempat sampah Drive.</p>', ok: 'Hapus', danger: true, onOk: function () {
    return api('berkas_hapus', { id_berkas: id }).then(function () { const c = S.det[S.params.id]; if (c && c.d) c.d.berkas = c.d.berkas.filter(function (b) { return b.id !== id; }); renderDetailBody(); toast('ok', 'Berkas dihapus.'); });
  } });
}

/* ----------------------------- Admin: pengguna ----------------------------- */
function vUsers() {
  setTitle('Pengguna'); setView('<div class="ph"><div><h2>Manajemen pengguna</h2><p>Kelola akun internal dan mitra.</p></div><div class="sp"></div><button class="btn btn-p" data-act="addUser">' + mi('person_add') + ' Tambah pengguna</button></div><div id="uBody">' + skel() + '</div>');
  const draw = function () {
    $('uBody').innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Lembaga</th><th>Status</th><th></th></tr></thead><tbody>' + S.users.map(function (u) { return '<tr style="cursor:default"><td class="t-b">' + esc(u.nama) + '</td><td>' + esc(u.email) + '</td><td>' + esc(u.peran_nama) + '</td><td>' + esc(u.lembaga) + '</td><td><span class="chip ' + (u.aktif ? 'c-ok' : 'c-bad') + '">' + (u.aktif ? 'Aktif' : 'Nonaktif') + '</span></td><td style="white-space:nowrap"><button class="btn btn-o btn-s" data-act="toggleUser" data-id="' + esc(u.id) + '">' + (u.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button> <button class="btn btn-o btn-s" data-act="resetUser" data-id="' + esc(u.id) + '">Reset sandi</button></td></tr>'; }).join('') + '</tbody></table></div>';
  };
  if (S.users) draw(); api('daftar_user').then(function (u) { S.users = u; if (S.view === 'users') draw(); }).catch(function (e) { toast('bad', e.message); });
}
function showPw(title, user, pw) { modal({ title: title, body: '<p>Akun: <b>' + esc(user.email) + '</b></p><p style="margin-top:8px">Kata sandi sementara:</p><div class="card" style="font-family:monospace;font-size:18px;text-align:center;padding:12px;margin-top:6px;user-select:all">' + esc(pw) + '</div><p class="hint" style="margin-top:8px">Catat sekarang; kata sandi tidak ditampilkan lagi.</p>', hideCancel: true }); }
function addUser() {
  const roles = [['prl', 'Tim Bidang PRL'], ['uptd', 'UPTD Pengelola Kawasan'], ['kepala_dkp', 'Kepala Dinas'], ['admin', 'Admin Sistem'], ['mitra', 'Mitra']];
  modal({ title: 'Tambah pengguna', body: '<div class="fld"><label>Nama <i>*</i></label><input class="in" id="auN"></div><div class="fld"><label>' + (googleOnlyUI() ? 'Email Google' : 'Email') + ' <i>*</i></label><input class="in" type="email" id="auE"></div><div class="row2"><div class="fld"><label>Peran <i>*</i></label><select class="in" id="auR">' + roles.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('') + '</select></div><div class="fld"><label>Lembaga</label><input class="in" id="auL"></div></div>', ok: 'Buat akun', onOk: function () {
    return api('buat_user', { nama: $('auN').value, email: $('auE').value, peran: $('auR').value, lembaga: $('auL').value }).then(function (r) { S.users = null; setTimeout(function () { if (r.password) showPw('Akun dibuat', r.user, r.password); else modal({ title: 'Akun dibuat', body: '<p>Pengguna <b>' + esc(r.user.email) + '</b> dapat langsung masuk dengan tombol <b>Masuk dengan Google</b> memakai akun Google tersebut. Tidak ada kata sandi yang perlu dibagikan.</p>', ok: 'Mengerti', hideCancel: true, onOk: function () { closeModal(); } }); if (S.view === 'users') vUsers(); }, 50); });
  } });
}

/* ----------------------------- Admin: data master ----------------------------- */
function vMaster() {
  setTitle('Data Master'); const m = S.master;
  setView('<div class="ph"><div><h2>Data master</h2><p>Kawasan, persyaratan per jenis mitra, dan kontak bantuan.</p></div><div class="sp"></div><button class="btn btn-p" data-act="saveMaster">' + mi('save') + ' Simpan semua</button></div>' +
    '<div class="card" style="margin-bottom:16px"><h3>Kawasan konservasi</h3><p class="sub">Satu baris per kawasan. Format: <code>Nama | Dasar hukum | Zona1; Zona2</code></p><textarea class="in" id="mKaw" rows="6">' + esc(m.kawasan.map(function (k) { return k.nama + ' | ' + (k.dasar || '') + ' | ' + k.zona.join('; '); }).join('\n')) + '</textarea></div>' +
    '<div class="card" style="margin-bottom:16px"><h3>Persyaratan per jenis mitra</h3><p class="sub">Satu persyaratan per baris.</p>' + m.jenis.map(function (j) { return '<div class="fld"><label>' + esc(j.nama) + '</label><textarea class="in" rows="3" data-mj="' + esc(j.kode) + '">' + esc((m.persyaratan[j.kode] || []).join('\n')) + '</textarea></div>'; }).join('') + '</div>' +
    batasCardHtml() + '<div class="card"><h3>Layanan bantuan</h3><div class="row2"><div class="fld"><label>Email</label><input class="in" id="mHE" value="' + esc((m.config || {}).helpdesk_email || '') + '"></div><div class="fld"><label>Telepon</label><input class="in" id="mHT" value="' + esc((m.config || {}).helpdesk_telp || '') + '"></div></div></div>');
  fillBatas();
}
function saveMaster(btn) {
  const kaw = $('mKaw').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { const p = l.split('|'); return { nama: (p[0] || '').trim(), dasar: (p[1] || '').trim(), zona: (p[2] || '').split(';').map(function (z) { return z.trim(); }).filter(Boolean) }; });
  const per = {}; document.querySelectorAll('[data-mj]').forEach(function (t) { per[t.dataset.mj] = t.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); });
  loadingBtn(btn, true); api('master_simpan', { kawasan: kaw, persyaratan: per, config: { helpdesk_email: $('mHE').value, helpdesk_telp: $('mHT').value } }).then(function (m) { S.master = m; persist(); toast('ok', 'Data master tersimpan.'); }).catch(function (e) { toast('bad', e.message); }).then(function () { loadingBtn(btn, false); });
}

/* ----------------------------- Akun ----------------------------- */
function vAkun() {
  setTitle('Pengaturan Akun'); const m = S.me;
  setView('<div class="ph"><div><h2>Pengaturan akun</h2></div></div><div class="grid g2"><div class="card"><h3>Profil</h3><dl class="kv" style="margin-top:10px"><dt>Nama</dt><dd>' + esc(m.nama) + '</dd><dt>Email</dt><dd>' + esc(m.email) + '</dd><dt>Peran</dt><dd>' + esc(m.peran_nama) + '</dd><dt>Lembaga</dt><dd>' + esc(m.lembaga || '-') + '</dd></dl></div>' +
    (googleOnlyUI() ? '<div class="card"><h3>Masuk dengan Google</h3><p class="sub" style="margin-top:8px">Akun ini masuk memakai akun Google <b>' + esc(m.email) + '</b>. Kata sandi dan verifikasi dua langkah dikelola oleh Google, sehingga tidak ada kata sandi aplikasi yang perlu diganti.</p></div>' : '<div class="card"><h3>Ganti kata sandi</h3><div class="fld" style="margin-top:10px"><label>Kata sandi lama</label><input type="password" class="in" id="gpO" autocomplete="current-password"></div><div class="fld"><label>Kata sandi baru (min. 8)</label><input type="password" class="in" id="gpN" autocomplete="new-password"></div><button class="btn btn-p" data-act="changePw">Simpan</button></div>') + '</div>');
}

/* ----------------------------- Notifikasi & verifikasi ----------------------------- */
function renderNotif() {
  const p = $('notifPop'); p.innerHTML = S.notif.length ? '<div style="padding:10px 14px;display:flex;justify-content:space-between;border-bottom:1px solid var(--line)"><b>Notifikasi</b><button class="btn btn-s btn-o" data-act="readAll">Tandai dibaca</button></div>' + S.notif.map(function (n) { const nw = !(n.dibaca === true || n.dibaca === 'TRUE'); return '<div class="n ' + (nw ? 'new' : '') + '" data-act="openNotif" data-id="' + esc(n.id_pengajuan) + '"><b>' + esc(n.judul) + '</b><span>' + esc(n.pesan) + '</span><small>' + ago(n.waktu) + '</small></div>'; }).join('') : '<div class="empty" style="padding:24px">' + mi('notifications_off') + 'Belum ada notifikasi.</div>';
}
function openVerif() {
  modal({ title: 'Verifikasi dokumen resmi', sub: 'Masukkan kode verifikasi pada Berita Acara / PKS.', body: '<div class="fld"><input class="in" id="vkKode" placeholder="BA:xxxxxxxx-…:xxxxxxxxxxxx"></div><div id="vkRes"></div>', ok: 'Periksa', onOk: function () {
    return api('verifikasi', { kode: $('vkKode').value }).then(function (r) { $('vkRes').innerHTML = r.valid ? '<div class="callout ok">' + mi('verified') + '<span><b>Dokumen sah.</b><br>' + esc(r.tipe) + ' ' + esc(r.nomor) + ' (' + esc(r.status) + ')<br>' + esc(r.lembaga) + ' — ' + esc(r.judul) + '<br>' + esc(r.kawasan) + '</span></div>' : '<div class="callout bad">' + mi('error') + '<span>' + esc(r.pesan) + '</span></div>'; return false; });
  } });
}

/* ----------------------------- Delegasi event ----------------------------- */
const CHG = {};
const ACT = {
  pfBatal: function () { $('formProfil').hidden = true; $('googleBox').hidden = false; S._gcredReg = null; },
  gRetry: function () { applyAuthMode(); },
  'auth-tab': function (el) { const l = el.dataset.v === 'login'; $('formLogin').hidden = !l; $('formReg').hidden = l; $('tabLogin').classList.toggle('on', l); $('tabReg').classList.toggle('on', !l); },
  togglePw: function (el) { const i = el.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; },
  openVerif: openVerif, openNav: openNav, closeNav: closeNav, closeModal: closeModal,
  modalBg: function (el, e) { if (e.target === el) closeModal(); },
  logout: function () { modal({ title: 'Keluar dari aplikasi?', ok: 'Keluar', onOk: function () { const t = S.token; closeModal(); api('logout').catch(function () {}); forceLogout(); } }); },
  toggleTheme: function () { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); },
  toggleNotif: function () { const p = $('notifPop'); if (p.hidden) renderNotif(); p.hidden = !p.hidden; closePop('notifPop'); },
  readAll: function () { S.notif.forEach(function (n) { n.dibaca = true; }); renderNotif(); renderNav(); persist(); api('notif_baca', { semua: true }).catch(function () {}); },
  openNotif: function (el) { closePop(); const id = el.dataset.id; if (pById(id)) navigateTo('detail', { id: id }); },
  nav: function (el) { const it = navItems()[+el.dataset.i]; navigateTo(it.id, it.p || {}); },
  goTahap: function (el) { navigateTo('daftar', { tahap: el.dataset.t }); },
  goDaftar: function (el) { navigateTo('daftar', JSON.parse(el.dataset.p || '{}')); },
  newForm: function () { if (S.me.peran !== 'mitra') return; S.wiz = null; navigateTo('form', {}); },
  editP: function (el) { S.wiz = null; navigateTo('form', { id: el.dataset.id }); },
  open: function (el) { navigateTo('detail', { id: el.dataset.id }); },
  back: function () { goBack('daftar'); },
  sort: function (el) { const k = el.dataset.k; if (S.f.sort === k) S.f.dir *= -1; else { S.f.sort = k; S.f.dir = 1; } renderList(); },
  page: function (el) { S.f.page = +el.dataset.n; renderList(); window.scrollTo(0, 0); },
  tab: function (el) { S.tab = el.dataset.t; S.dirty = false; renderDetailBody(); },
  maju: function (el) { const p = curP(); const t = (S.master.trans[p.tahap] || []).filter(function (x) { return x.k === el.dataset.k; })[0]; if (t) openMaju(p, t); },
  wNext: function () { const e = wizValidate(S.wiz.step); $('wErr').textContent = e; if (!e) { S.wiz.step++; renderWiz(); window.scrollTo(0, 0); } },
  wBack: function () { if (S.wiz.step) { S.wiz.step--; renderWiz(); } else { S.wiz = null; goBack('daftar'); } },
  wSave: function () { for (let i = 0; i < 4; i++) { const e = wizValidate(i); if (e) { S.wiz.step = i; renderWiz(); $('wErr').textContent = e; return; } } wizSave(); },
  saveCk: saveChecklist, saveTp: saveTelaahProgram, saveTb: saveTelaahBiaya, saveMv: saveMonev,
  saveBA: function (el) { saveBA(el, el.dataset.j); }, sahBA: function (el) { sahkanBA(el.dataset.id); }, savePks: function (el) { savePKS(el); },
  dl: function (el, e) { e.preventDefault(); downloadFile(el.dataset.id); }, delFile: function (el) { deleteFile(el.dataset.id); },
  addUser: addUser, saveMaster: saveMaster,
  toggleUser: function (el) { const u = S.users.filter(function (x) { return x.id === el.dataset.id; })[0]; api('ubah_user', { id: u.id, aktif: !u.aktif }).then(function (r) { u.aktif = r.user.aktif; vUsers(); toast('ok', 'Status akun diperbarui.'); }).catch(function (e) { toast('bad', e.message); }); },
  resetUser: function (el) { if (googleOnlyUI()) { toast('', 'Pengguna masuk dengan Google; tidak ada kata sandi untuk direset.'); return; } const u = S.users.filter(function (x) { return x.id === el.dataset.id; })[0]; modal({ title: 'Reset kata sandi?', sub: esc(u.email), ok: 'Reset', onOk: function () { return api('ubah_user', { id: u.id, reset: true }).then(function (r) { setTimeout(function () { showPw('Kata sandi baru', r.user, r.password); }, 50); }); } }); },
  changePw: function (el) { loadingBtn(el, true); api('ganti_password', { lama: $('gpO').value, baru: $('gpN').value }).then(function () { toast('ok', 'Kata sandi diganti.'); $('gpO').value = ''; $('gpN').value = ''; }).catch(function (e) { toast('bad', e.message); }).then(function () { loadingBtn(el, false); }); }
};
function bindEvents() {
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-act]'); if (el && ACT[el.dataset.act]) { ACT[el.dataset.act](el, e); }
    if (!e.target.closest('#notifPop') && !e.target.closest('[data-act="toggleNotif"]')) { const q = $('notifPop'); if (q) q.hidden = true; }
    if (e.target.closest('#profPop button') && !e.target.closest('[data-act="toggleTheme"]')) { const q = $('profPop'); if (q) q.hidden = true; }
    if (!e.target.closest('#profPop') && !e.target.closest('[data-act="toggleProf"]')) { const q = $('profPop'); if (q) q.hidden = true; }
  });
  document.addEventListener('input', function (e) {
    const t = e.target;
    if (t.dataset.f !== undefined && S.wiz) { S.wiz.data[t.dataset.f] = t.value; if (!S.wiz.editId) LS.set('sm_form', S.wiz.data); if (t.dataset.f === 'uraian') $('wc').textContent = '(' + words(t.value) + '/500 kata)'; }
    if (t.dataset.ck || t.dataset.tp || t.dataset.ba) S.dirty = true;
  });
  document.addEventListener('change', function (e) {
    const t = e.target;
    if (t.dataset.f !== undefined && S.wiz) { S.wiz.data[t.dataset.f] = t.value; if (!S.wiz.editId) LS.set('sm_form', S.wiz.data); if (t.dataset.f === 'kawasan') { S.wiz.data.zona = ''; renderWiz(); } }
    if (t.dataset.ck || t.dataset.tp || t.dataset.ba) S.dirty = true;
    if (t.dataset.chg === 'upload') uploadFile(t); else if (t.dataset.chg && CHG[t.dataset.chg]) CHG[t.dataset.chg](t);
  });
  /* Prefetch detail saat hover/sentuh (Instant UX) */
  const pf = debounce(function (id) { prefetch(id); }, 70);
  ['mouseover', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function (e) { const r = e.target.closest && e.target.closest('[data-act="open"]'); if (r) pf(r.dataset.id); }, { passive: true }); });
  $('gSearch').addEventListener('input', debounce(function () {
    const q = this.value; if (S.view === 'daftar') { S.f.q = q; S.f.page = 1; const fq = $('fQ'); if (fq) fq.value = q; renderList(); } else if (q) { navigateTo('daftar', { q: q }); }
  }, 150));
  bindAuth();
  document.addEventListener('error', function (e) { const t = e.target; if (t && t.tagName === 'IMG' && t.classList.contains('logo-img') && !t.dataset.fb) { t.dataset.fb = '1'; t.src = LOGO_FALLBACK; } }, true);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true }); });
  pollLoop();
}

/* ----------------------------- Sinkron latar & boot ----------------------------- */
/* Polling adaptif (hemat kuota eksekusi GAS): 30 dtk saat aktif, 120 dtk saat diam, berhenti saat tab tersembunyi. */
let lastAct = Date.now();
function pollLoop() {
  const ms = Date.now() - lastAct < 120000 ? 30000 : 120000;
  setTimeout(function () { (!document.hidden && S.token ? refresh() : Promise.resolve()).then(pollLoop, pollLoop); }, ms);
}
function refresh() {
  if (!S.token || S.pending > 0) return Promise.resolve();
  return api('me').then(function (r) {
    if (S.pending > 0) return; hydrate(r); persist(); renderNav();
    const sig = S.daftar.length + '|' + S.daftar.map(function (p) { return p.diubah; }).sort().pop() + '|' + (S.timeline[0] && S.timeline[0].id) + '|' + S.notif.length + '|' + S.monev.length;
    if (sig === S._sig) return; S._sig = sig;
    if (S.view === 'dashboard') vDashboard(); else if (S.view === 'daftar') renderList();
    else if (S.view === 'detail') { const c = S.det[S.params.id]; if (!c || Date.now() - c.t > 20000) loadDetail(S.params.id); }
  }).catch(function () {});
}
function loadPublicMaster() {
  apiGet('master').then(function (m) { LS.set('sm_pub', m); if (!S.token) { S.master = m; showAuth(); } else if (!S.master) S.master = m; }).catch(function () {});
}
function init() {
  applyTheme(); bindEvents();
  try { document.fonts.load('20px "Material Symbols Outlined"').then(function () { document.documentElement.classList.add('icons-ok'); }); setTimeout(function () { if (document.fonts.check('20px "Material Symbols Outlined"')) document.documentElement.classList.add('icons-ok'); }, 2500); } catch (e) { document.documentElement.classList.add('icons-ok'); }
  const tok = LS.get('sm_tok'), snap = LS.get('sm_snap'); const pub = LS.get('sm_pub');
  if (tok && snap && snap.me) { S.token = tok; hydrate(snap); S.peta = LS.get('sm_peta'); showApp(); navigateTo('dashboard', {}, { replace: true }); refresh(); }
  else { if (pub) S.master = pub; showAuth(); loadPublicMaster(); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
