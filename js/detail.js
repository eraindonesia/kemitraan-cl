/* ----------------------------- Form Lampiran II (wizard 5 langkah) ----------------------------- */
const WSTEPS = ['Identitas Mitra', 'Program', 'Lokasi', 'Pembiayaan', 'Tinjau'];
function vForm() {
  const id = S.params.id; setTitle(id ? 'Ubah Pengajuan' : 'Ajukan Kemitraan');
  if (!S.wiz || S.wiz.editId !== (id || null)) {
    const p = id && pById(id); const saved = !id && LS.get('sm_form');
    S.wiz = { step: 0, editId: id || null, data: p ? { judul: p.judul, uraian: p.uraian, jangka: p.jangka, kawasan: p.kawasan, zona: p.zona, wilayah: p.wilayah, lokasi: p.lokasi, luas: p.luas, biaya: p.biaya, sumber: p.sumber } : (saved || {}) };
    if (id) { const cd = S.det[id] && S.det[id].d; if (cd) S.wiz.data.programs = progFromDet(cd.programs); else loadDetail(id).then(function (r) { if (S.wiz && S.wiz.editId === id && S.wiz.data.programs === undefined) { S.wiz.data.programs = progFromDet(r.programs); if (S.view === 'form') renderWiz(); } }); }
  }
  if (isSuper() && !S.users) api('daftar_user').then(function (u) { S.users = u; if (S.view === 'form') renderWiz(); }).catch(function () {});
  setView('<div class="ph"><div><h2>' + (id ? 'Ubah pengajuan' : 'Formulir Pengajuan (Lampiran II)') + '</h2><p>Isi data program kemitraan. Draft tersimpan otomatis di perangkat ini.</p></div></div><div class="card" id="wizBox"></div>');
  renderWiz();
}
function renderWiz() {
  MapKit.disposeAll(); S.wizEd = null;
  const w = S.wiz, d = w.data, st = w.step; const f = function (k) { return esc(d[k] === undefined ? '' : d[k]); };
  let c = '';
  if (st === 0) {
    if (isSuper()) c = '<div class="fld"><label>Mitra pemilik pengajuan <i>*</i></label><select class="in" data-f="id_user"><option value="">Pilih mitra…</option>' + (S.users || []).filter(function (u) { return u.peran === 'mitra' && u.aktif; }).map(function (u) { return '<option value="' + esc(u.id) + '"' + (d.id_user === u.id ? ' selected' : '') + '>' + esc(u.lembaga + ' — ' + u.nama) + '</option>'; }).join('') + '</select></div>';
    else c = '<dl class="kv"><dt>Lembaga</dt><dd>' + esc(S.me.lembaga) + '</dd><dt>Jenis mitra</dt><dd>' + esc(jenisNama(S.me.jenis_mitra)) + '</dd><dt>Penanggung jawab</dt><dd>' + esc(S.me.nama) + '</dd><dt>Email</dt><dd>' + esc(S.me.email) + '</dd></dl><div class="callout info" style="margin-top:14px">' + mi('info') + '<span>Data identitas diambil dari akun Anda. Ubah melalui administrator bila keliru.</span></div>';
  } else if (st === 1) {
    c = '<div class="fld"><label>Judul / nama program <i>*</i></label><input class="in" data-f="judul" value="' + f('judul') + '"></div>' +
      '<div class="fld"><label>Uraian program <i>*</i> <span class="hint" id="wc">(' + words(d.uraian) + '/500 kata)</span></label><textarea class="in" data-f="uraian" rows="6">' + f('uraian') + '</textarea></div>' +
      '<div class="fld"><label>Jangka waktu kemitraan</label><input class="in" data-f="jangka" placeholder="mis. 3 Tahun" value="' + f('jangka') + '"></div>' + progPicker(d);
  } else if (st === 2) {
    const k = S.master.kawasan.filter(function (x) { return x.nama === d.kawasan; })[0]; const zs = k ? k.zona : [];
    c = '<div class="fld"><label>Wilayah UPTD tempat kegiatan <i>*</i></label><select class="in" data-f="wilayah"><option value="">Pilih wilayah…</option>' + (S.master.wilayah || []).map(function (x) { return '<option value="' + esc(x.kode) + '"' + (d.wilayah === x.kode ? ' selected' : '') + '>' + esc(x.nama) + (x.cakupan ? ' — ' + esc(x.cakupan) : '') + '</option>'; }).join('') + '</select><p class="hint">Pengajuan ditangani UPTD sesuai wilayah lokasi kegiatan Anda.</p></div>' +
      '<div class="row2"><div class="fld"><label>Kawasan konservasi <i>*</i></label><select class="in" data-f="kawasan"><option value="">Pilih kawasan…</option>' + S.master.kawasan.map(function (x) { return '<option' + (d.kawasan === x.nama ? ' selected' : '') + '>' + esc(x.nama) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label>Zona <i>*</i></label><select class="in" data-f="zona"><option value="">Pilih zona…</option>' + zs.map(function (z) { return '<option' + (d.zona === z ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="fld"><label>Lokasi / area kegiatan <i>*</i></label><input class="in" data-f="lokasi" value="' + f('lokasi') + '"></div><div class="fld"><label>Luas area</label><input class="in" data-f="luas" placeholder="mis. 25 Ha" value="' + f('luas') + '"></div>';
    if (!w.editId) { c += '<div class="fld"><label>Area pengelolaan (opsional)</label><p class="hint">Unggah <b>Shapefile</b> (.zip) area kegiatan yang diusulkan. Dapat diganti atau ditambah nanti pada tab Peta Area selama usulan masih Draft.</p><div id="wizMap"></div></div>'; setTimeout(wizMapInit, 0); }
  } else if (st === 3) {
    c = '<div class="row2"><div class="fld"><label>Total rencana anggaran (Rp)</label><input class="in" type="number" min="0" data-f="biaya" value="' + f('biaya') + '"></div><div class="fld"><label>Sumber pembiayaan</label><input class="in" data-f="sumber" placeholder="Swadaya / CSR / hibah…" value="' + f('sumber') + '"></div></div>' +
      '<div class="callout info">' + mi('attach_file') + '<span>Dokumen persyaratan diunggah pada halaman detail setelah draft disimpan.</span></div>';
  } else {
    const req = (S.master.persyaratan[S.me.jenis_mitra] || []);
    c = '<dl class="kv"><dt>Judul</dt><dd>' + f('judul') + '</dd><dt>Wilayah UPTD</dt><dd>' + esc(wilayahNama(d.wilayah)) + '</dd><dt>Kawasan / zona</dt><dd>' + f('kawasan') + ' / ' + f('zona') + '</dd><dt>Lokasi</dt><dd>' + f('lokasi') + ' (' + f('luas') + ')</dd><dt>Jangka</dt><dd>' + f('jangka') + '</dd><dt>Anggaran</dt><dd>' + rp(d.biaya) + ' · ' + f('sumber') + '</dd><dt>Uraian</dt><dd>' + f('uraian') + '</dd><dt>Program</dt><dd>' + progReview(d) + '</dd></dl>' +
      (req.length && S.me.peran === 'mitra' ? '<h3 style="margin:16px 0 6px">Dokumen yang perlu disiapkan</h3><ul style="padding-left:18px;color:var(--tx-2)">' + req.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '');
    if (d.area && d.area.geojson) c += '<p class="t-sub" style="margin-top:10px">Area peta: ' + numID(MapKit.areaHa(MapKit.parse(d.area.geojson))) + ' Ha</p>';
  }
  $('wizBox').innerHTML = '<div class="wiz-h">' + WSTEPS.map(function (s, i) { return '<span class="' + (i <= st ? 'on' : '') + '">' + (i + 1) + '. ' + s + '</span>'; }).join('') + '</div><div class="wiz">' + WSTEPS.map(function (s, i) { return '<div class="' + (i <= st ? 'on' : '') + '"></div>'; }).join('') + '</div>' + c +
    '<div id="wErr" class="errtxt" role="alert"></div><div class="act-bar" style="position:static;box-shadow:none;border:0;padding:12px 0 0"><button class="btn btn-o" data-act="wBack">' + (st ? 'Kembali' : 'Batal') + '</button><div class="sp"></div>' +
    (st === 4 ? '<button class="btn btn-p" data-act="wSave">' + mi('save') + ' ' + (w.editId ? 'Simpan perubahan' : 'Simpan draft') + '</button>' : '<button class="btn btn-p" data-act="wNext">Lanjut ' + mi('arrow_forward') + '</button>') + '</div>';
}
/* ----------------------------- Program yang dijalankan mitra ----------------------------- */
function progFromDet(list) { return (list || []).map(function (x) { return { jenis: x.jenis, id_program: x.id_program, nama: x.nama, keterangan: x.keterangan || '' }; }); }
function progList(d) { return Array.isArray(d.programs) ? d.programs : []; }
function progPicker(d) {
  const sel = progList(d); const dinas = (S.master.program || []).filter(function (x) { return x.aktif; });
  const isSel = function (id) { return sel.some(function (x) { return x.jenis === 'dinas' && x.id_program === id; }); };
  const mand = sel.filter(function (x) { return x.jenis === 'mandiri'; });
  return '<div class="fld" style="margin-top:6px"><label>Program yang akan dijalankan <i>*</i> <span class="hint">(' + sel.length + ' dipilih)</span></label><p class="hint">Pilih program yang ditawarkan Dinas Kelautan dan Perikanan Provinsi Sulawesi Tengah, dan/atau tambahkan program Anda sendiri.</p>' +
    '<div class="prog-list">' + (dinas.length ? dinas.map(function (x) {
      return '<label class="prog-it"><input type="checkbox" data-chg="progDinas" data-id="' + esc(x.id) + '"' + (isSel(x.id) ? ' checked' : '') + '><span><b>' + esc(x.nama) + '</b>' + (x.deskripsi ? '<small>' + esc(x.deskripsi) + '</small>' : '') + '</span></label>';
    }).join('') : '<p class="hint">Dinas belum menetapkan program yang ditawarkan.</p>') + '</div>' +
    '<h4 style="margin:14px 0 6px">Program sendiri</h4>' + mand.map(function (x, i) {
      return '<div class="prog-own"><input class="in" data-chg="progNama" data-i="' + i + '" placeholder="Nama program" value="' + esc(x.nama) + '"><input class="in" data-chg="progKet" data-i="' + i + '" placeholder="Keterangan singkat (opsional)" value="' + esc(x.keterangan) + '"><button type="button" class="btn btn-o btn-s" data-act="progDel" data-i="' + i + '" aria-label="Hapus program">' + mi('delete') + '</button></div>';
    }).join('') + '<button type="button" class="btn btn-o btn-s" data-act="progAdd">' + mi('add') + ' Tambah program sendiri</button></div>';
}
function progReview(d) {
  const l = progList(d); return l.length ? '<ul style="padding-left:18px">' + l.map(function (x) { return '<li>' + esc(x.nama) + (x.jenis === 'mandiri' ? ' <span class="chip c-draft">Program sendiri</span>' : ' <span class="chip c-teal">Program Dinas</span>') + (x.keterangan ? '<div class="t-sub">' + esc(x.keterangan) + '</div>' : '') + '</li>'; }).join('') + '</ul>' : '<span class="t-sub">-</span>';
}
function wizMapInit() {
  const el = $('wizMap'); if (!el || S.view !== 'form' || !S.wiz || S.wiz.step !== 2) return; const d = S.wiz.data;
  const ed = MapKit.editor(el, { geom: d.area && d.area.geojson, kawasan: d.kawasan, batas: S.peta ? S.peta.batas : [], maxChars: 40000, shpOnly: true,
    onChange: function (g) { d.area = g ? { nama: 'Area 1', geojson: g } : null; LS.set('sm_form', d); } });
  S.wizEd = ed; if (!S.peta && ed) loadPeta().then(function () { if (S.wizEd === ed) ed.setBatas(S.peta.batas); }).catch(function () {});
}
function wizValidate(st) {
  const d = S.wiz.data;
  if (st === 0 && isSuper() && !d.id_user) return 'Pilih mitra pemilik pengajuan.';
  if (st === 1) { if (!progList(d).length) return 'Pilih minimal satu program Dinas atau tambahkan program sendiri.'; if (progList(d).some(function (x) { return x.jenis === 'mandiri' && !x.nama.trim(); })) return 'Nama program sendiri tidak boleh kosong.'; if (!(d.judul || '').trim() || !(d.uraian || '').trim()) return 'Judul dan uraian program wajib diisi.'; if (words(d.uraian) > 500) return 'Uraian maksimal 500 kata.'; }
  if (st === 2 && !d.wilayah) return 'Pilih wilayah UPTD tempat kegiatan dilaksanakan.';
  if (st === 2 && (!d.kawasan || !d.zona || !(d.lokasi || '').trim())) return 'Kawasan, zona, dan lokasi wajib diisi.';
  if (st === 3 && d.biaya !== undefined && d.biaya !== '' && Number(d.biaya) < 0) return 'Anggaran tidak boleh negatif.';
  return '';
}
function wizSave() {
  const w = S.wiz; const d = Object.assign({}, w.data); d.biaya = d.biaya === undefined ? '' : d.biaya; const now = new Date().toISOString();
  if (w.editId) {
    const before = Object.assign({}, pById(w.editId)); if (d.programs !== undefined) delete S.det[before.id]; replaceP(Object.assign({}, before, d, { diubah: now }));
    toast('ok', 'Perubahan disimpan.'); S.wiz = null; navigateTo('detail', { id: before.id }, { replace: true });
    bg('Simpan perubahan', function () { d.id = before.id; return api('ubah', d).then(function (r) { replaceP(r); delete S.det[r.id]; }); }, function () { replaceP(before); });
    return;
  }
  const tmp = { id: 'tmp_' + Date.now(), nomor: 'Menyimpan…', id_user: S.me.id, lembaga: S.me.lembaga, jenis_mitra: S.me.jenis_mitra, judul: d.judul, wilayah: d.wilayah, kawasan: d.kawasan, zona: d.zona, lokasi: d.lokasi, luas: d.luas || '', uraian: d.uraian, biaya: d.biaya, sumber: d.sumber || '', jangka: d.jangka || '', tahap: 1, status: 'Draft', dibuat: now, diubah: now, diubah_oleh: S.me.nama, _pending: true };
  S.daftar.unshift(tmp); LS.del('sm_form'); S.wiz = null; toast('ok', 'Draft dibuat, sedang disimpan ke server…'); navigateTo('daftar', {}, { replace: true });
  bg('Buat pengajuan', function () {
    return api('buat', d).then(function (p) { S.daftar = S.daftar.filter(function (x) { return x.id !== tmp.id; }); S.daftar.unshift(p); S.peta = null; toast('ok', 'Draft tersimpan: ' + p.nomor); if (S.view === 'daftar') renderList(); else if (S.view === 'dashboard') vDashboard(); renderNav(); });
  }, function () { S.daftar = S.daftar.filter(function (x) { return x.id !== tmp.id; }); LS.set('sm_form', d); if (S.view === 'daftar') renderList(); });
}

/* ----------------------------- Detail pengajuan ----------------------------- */
function prefetch(id) { if (!id || String(id).indexOf('tmp_') === 0) return; const c = S.det[id]; if (c && Date.now() - c.t < 20000) return; loadDetail(id); }
function loadDetail(id, force) {
  const c = S.det[id]; if (c && c.busy) return c.busy;
  const pr = api('detail', { id: id }).then(function (r) { S.det[id] = { d: r, t: Date.now() }; replaceP(r.pengajuan); if (S.view === 'detail' && S.params.id === id && (!S.dirty || force)) renderDetailBody(); return r; })
    .catch(function (e) { if (S.view === 'detail' && S.params.id === id && !S.det[id]) { $('dBody').innerHTML = '<div class="callout bad">' + mi('error') + '<span>' + esc(e.message) + '</span></div>'; } });
  S.det[id] = Object.assign({}, c || { t: 0 }, { busy: pr }); pr.then(function () { if (S.det[id] && S.det[id].busy) delete S.det[id].busy; }); return pr;
}
function vDetail() {
  const p = pById(S.params.id); if (!p) { navigateTo('daftar', {}, { replace: true }); return; }
  setTitle(p.nomor); S.tab = S.params.tab || 'ringkasan';
  setView('<div class="ph"><button class="btn btn-o btn-s" data-act="back">' + mi('arrow_back') + ' Kembali</button><div><h2 id="dTitle"></h2><p id="dSub"></p></div><div class="sp"></div><span id="dChip"></span></div><div id="dBody"></div>');
  renderDetailBody(); const c = S.det[p.id]; if (!c || !c.d || Date.now() - c.t > 20000) loadDetail(p.id);
}
function detData() { const c = S.det[S.params.id]; return c && c.d ? c.d : null; }
function canUploadDoc(p) { if (FINAL.indexOf(p.status) > -1) return false; if (S.me.peran === 'mitra') return p.id_user === S.me.id && p.tahap === 1 && (p.status === 'Draft' || p.status === 'Perlu dilengkapi'); if (S.me.peran === 'superadmin') return false; if (S.me.peran === 'admin' || S.me.peran === 'uptd') return p.tahap === 3 || p.tahap >= 9; return false; }
function canEditP(p) { return S.me.peran !== 'prl' && S.me.peran !== 'uptd' && S.me.peran !== 'admin' && S.me.peran !== 'kepala_dkp' && p.tahap === 1 && (p.status === 'Draft' || p.status === 'Perlu dilengkapi') && (isSuper() || p.id_user === S.me.id); }
function tabsFor(p) {
  const t = [['ringkasan', 'Ringkasan'], ['dokumen', 'Dokumen']];
  if (isStaff() || p.tahap > 3) t.push(['checklist', 'Checklist Administrasi (L-III)']);
  if (isStaff() || p.tahap > 4) t.push(['telaah', 'Telaah (L-IV/V)']);
  if (p.tahap === 6 || (detData() && detData().jadwal)) t.push(['jadwal', 'Jadwal Pemaparan']);
  t.push(['peta', 'Peta Area']); t.push(['ba', 'BA & PKS']); if (p.tahap === 12 || (detData() && detData().monev.length)) t.push(['monev', 'Monev']); t.push(['riwayat', 'Riwayat']); return t;
}
function renderDetailBody() {
  MapKit.disposeAll();
  const p = pById(S.params.id); if (!p) return; const d = detData();
  $('dTitle').textContent = p.judul; $('dSub').textContent = p.nomor + ' · ' + p.lembaga + ' · ' + p.kawasan; $('dChip').innerHTML = chip(p);
  const tabs = tabsFor(p); if (!tabs.some(function (t) { return t[0] === S.tab; })) S.tab = 'ringkasan';
  const stepper = '<div class="card"><div class="stepper">' + S.master.stages.map(function (s) { const stop = p.status === 'Tidak dilanjutkan' && s.no === p.tahap; const cl = stop ? 'stop' : (p.status === 'Selesai' || s.no < p.tahap) ? 'done' : s.no === p.tahap ? 'now' : ''; return '<div class="stp ' + cl + '" title="' + esc(s.nama) + '"><div class="n">' + (cl === 'done' ? mi('check', 'font-size:16px') : stop ? mi('close', 'font-size:16px') : s.no) + '</div><small>' + esc(SHORT[s.no - 1]) + '</small></div>'; }).join('') + '</div></div>';
  const ops = opsiFor(p);
  const bar = ops.length || canEditP(p) || isSuper() ? '<div class="act-bar"><span class="t-sub">' + mi('bolt', 'font-size:16px') + ' Tahap ' + p.tahap + ': ' + esc(stageName(p.tahap)) + '</span><div class="sp"></div>' + (canEditP(p) ? '<button class="btn btn-o" data-act="editP" data-id="' + esc(p.id) + '">' + mi('edit') + ' Ubah data</button>' : '') + ops.map(function (t) { const bad = /Tidak/.test(t.k); return '<button class="btn ' + (bad ? 'btn-w' : 'btn-p') + '" data-act="maju" data-k="' + esc(t.k) + '">' + esc(t.k) + '</button>'; }).join('') + (isSuper() ? '<button class="btn btn-o" style="color:var(--bad,#b3261e)" data-act="hapusP" data-id="' + esc(p.id) + '">' + mi('delete_forever') + ' Hapus permanen</button>' : '') + '</div>' : '';
  $('dBody').innerHTML = stepper + '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button class="' + (S.tab === t[0] ? 'on' : '') + '" role="tab" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="tabBody">' + tabHtml(p, d) + '</div>' + bar;
  afterDetailRender();
}
function skel() { return '<div class="card"><div class="sk" style="width:40%;margin-bottom:12px"></div><div class="sk" style="margin-bottom:8px"></div><div class="sk" style="width:80%;margin-bottom:8px"></div><div class="sk" style="width:60%"></div></div>'; }
function tabHtml(p, d) {
  if (S.tab === 'ringkasan') return tRingkasan(p, d);
  if (!d) return skel();
  return ({ dokumen: tDokumen, checklist: tChecklist, telaah: tTelaah, ba: tBA, monev: tMonev, jadwal: tJadwal, riwayat: tRiwayat, peta: tPeta }[S.tab] || tRingkasan)(p, d);
}
function tRingkasan(p, d) {
  let warn = '';
  if (p.status === 'Perlu dilengkapi' && d) { const r = d.riwayat.filter(function (x) { return x.keputusan === 'Tidak Lengkap'; })[0]; warn = '<div class="callout warn">' + mi('warning') + '<span><b>Perlu dilengkapi.</b> ' + esc(r ? r.catatan : 'Lengkapi dokumen sesuai catatan verifikator.') + '</span></div>'; }
  else if (p.status === 'Perlu dilengkapi') warn = '<div class="callout warn">' + mi('warning') + '<span><b>Perlu dilengkapi.</b> Lihat catatan pada tab Riwayat.</span></div>';
  if (p.status === 'Tidak dilanjutkan') warn = '<div class="callout bad">' + mi('block') + '<span>Pengajuan tidak dilanjutkan.</span></div>';
  if (d && d.jadwal && d.jadwal.status !== 'Dibatalkan' && p.tahap <= 6) warn += '<div class="callout ok" data-act="gotoTab" data-tab="jadwal" style="cursor:pointer">' + mi('event') + '<span><b>Pemaparan dijadwalkan:</b> ' + jadwalTeks(d.jadwal) + '</span></div>';
  return warn + '<div class="grid g-main"><div class="card"><h3>Data program</h3><p class="sub">Lampiran II</p><dl class="kv"><dt>Lembaga</dt><dd>' + esc(p.lembaga) + '</dd><dt>Jenis mitra</dt><dd>' + esc(jenisNama(p.jenis_mitra)) + '</dd><dt>Kawasan / zona</dt><dd>' + esc(p.kawasan) + ' / ' + esc(p.zona) + '</dd><dt>Lokasi</dt><dd>' + esc(p.lokasi) + ' ' + (p.luas ? '(' + esc(p.luas) + ')' : '') + '</dd><dt>Jangka waktu</dt><dd>' + esc(p.jangka || '-') + '</dd><dt>Anggaran</dt><dd>' + rp(p.biaya) + ' · ' + esc(p.sumber || '-') + '</dd><dt>Uraian</dt><dd style="white-space:pre-wrap">' + esc(p.uraian) + '</dd><dt>Wilayah UPTD</dt><dd>' + esc(wilayahNama(p.wilayah)) + '</dd><dt>Program</dt><dd>' + (d ? progReview({ programs: progFromDet(d.programs) }) : '<span class="t-sub">Memuat…</span>') + '</dd></dl></div>' +
    '<div class="card"><h3>Status</h3><p class="sub">Posisi saat ini</p><dl class="kv" style="grid-template-columns:100px 1fr"><dt>Tahap</dt><dd>' + p.tahap + '/12 — ' + esc(stageName(p.tahap)) + '</dd><dt>Status</dt><dd>' + chip(p) + '</dd><dt>Dibuat</dt><dd>' + fmtD(p.dibuat) + '</dd><dt>Diperbarui</dt><dd>' + fmtDT(p.diubah) + '<br><span class="t-sub">oleh ' + esc(p.diubah_oleh) + '</span></dd><dt>Pelaku tahap</dt><dd>' + esc((S.master.stages[p.tahap - 1] || {}).pelaku || '') + '</dd></dl></div></div>';
}
function wilayahNama(k) { const w = ((S.master && S.master.wilayah) || []).filter(function (x) { return x.kode === k; })[0]; return w ? w.nama : (k || '-'); }
function bisaLihat(b) { return /\.(pdf|jpe?g|png)$/i.test(b.nama || ''); }
function fileChip(b, del) { return '<span class="file">' + mi('description', 'font-size:15px') + '<span class="fn">' + esc(b.nama) + '</span><span class="t-sub">' + Math.round((b.ukuran || 0) / 1024) + ' KB</span>' + (bisaLihat(b) ? '<button type="button" class="fbtn" data-act="view" data-id="' + esc(b.id) + '" aria-label="Lihat ' + esc(b.nama) + '">' + mi('visibility', 'font-size:15px') + ' Lihat</button>' : '') + '<button type="button" class="fbtn" data-act="dl" data-id="' + esc(b.id) + '" aria-label="Unduh ' + esc(b.nama) + '">' + mi('download', 'font-size:15px') + ' Unduh</button>' + (del ? '<button data-act="delFile" data-id="' + esc(b.id) + '" aria-label="Hapus berkas">' + mi('close', 'font-size:15px') + '</button>' : '') + '</span>'; }
function dokItems(p) {
  const per = S.master.persyaratan || {}; let it = per[p.jenis_mitra] || []; let fb = false;
  if (!it.length) { fb = true; const ls = Object.keys(per).map(function (k) { return per[k]; }); it = ls.length ? ls[0].filter(function (x) { return ls.every(function (l) { return l.indexOf(x) > -1; }); }) : []; }
  return { items: it, fb: fb };
}
function dokMissing(p, d) { const di = dokItems(p); return di.items.filter(function (it) { return !d.berkas.some(function (b) { return b.item === it; }); }); }
function tDokumen(p, d) {
  const di = dokItems(p); const req = di.items.concat(['Lainnya']); const up = canUploadDoc(p); const n = di.items.length;
  const filled = di.items.filter(function (it) { return d.berkas.some(function (b) { return b.item === it; }); }).length;
  if (!S.dokSel || S.dokSel.id !== p.id) { const first = di.items.findIndex(function (it) { return !d.berkas.some(function (b) { return b.item === it; }); }); S.dokSel = { id: p.id, i: first > -1 ? first : 0 }; }
  const si = Math.min(S.dokSel.i, req.length - 1); const cur = req[si]; const isLain = cur === 'Lainnya';
  const pct = n ? Math.round(filled * 100 / n) : 0;
  const menu = req.map(function (it, i) {
    const c = d.berkas.filter(function (b) { return b.item === it; }).length; const lain = it === 'Lainnya';
    return '<button type="button" class="dok-it' + (i === si ? ' on' : '') + (c ? ' done' : '') + '" data-act="dokItem" data-i="' + i + '" aria-current="' + (i === si) + '"><span class="no">' + (c ? mi('check', 'font-size:16px') : (lain ? mi('attach_file', 'font-size:16px') : (i + 1))) + '</span><span class="tx">' + (lain ? 'Dokumen pendukung lainnya' : esc(it)) + (lain ? '<small>Opsional</small>' : '<small>' + (c ? c + ' berkas terunggah' : 'Belum diunggah') + '</small>') + '</span></button>';
  }).join('');
  const fs = d.berkas.filter(function (b) { return b.item === cur; });
  const pane = '<div class="dok-pane"><div class="dok-ph"><div><span class="eyebrow-s">' + (isLain ? 'Opsional' : 'Persyaratan ' + (si + 1) + ' dari ' + n) + '</span><h4>' + (isLain ? 'Dokumen pendukung lainnya' : esc(cur)) + '</h4></div>' +
    (isLain ? '' : (fs.length ? '<span class="chip c-ok">' + mi('check', 'font-size:14px') + ' Terunggah</span>' : '<span class="chip c-draft">Belum diunggah</span>')) + '</div>' +
    (up ? '<label class="dropz" for="fuCur" tabindex="0">' + mi('cloud_upload') + '<b>Pilih berkas untuk persyaratan ini</b><small>Hanya PDF · maks. 8 MB</small></label><input type="file" id="fuCur" data-item="' + esc(cur) + '" data-chg="upload" hidden accept=".pdf,application/pdf">' : '') +
    '<div class="dok-files">' + (fs.length ? fs.map(function (b) { return fileChip(b, up); }).join('') : '<p class="hint">Belum ada berkas pada poin ini.</p>') + '</div>' +
    '<div class="dok-nav"><button type="button" class="btn btn-o btn-s" data-act="dokItem" data-i="' + Math.max(0, si - 1) + '"' + (si === 0 ? ' disabled' : '') + '>' + mi('chevron_left') + ' Sebelumnya</button><button type="button" class="btn btn-o btn-s" data-act="dokItem" data-i="' + Math.min(req.length - 1, si + 1) + '"' + (si === req.length - 1 ? ' disabled' : '') + '>Berikutnya ' + mi('chevron_right') + '</button></div></div>';
  return '<div class="card dok"><div class="dok-top"><div><h3>Dokumen persyaratan</h3><p class="sub">Daftar persyaratan mengikuti Data Master untuk jenis mitra: <b>' + esc((((S.master.jenis || []).filter(function (j) { return j.kode === p.jenis_mitra; })[0]) || {}).nama || 'belum ditentukan') + '</b>.</p></div>' +
    '<div class="dok-prog"><b>' + filled + ' / ' + n + '</b><small>persyaratan terunggah</small><div class="bar"><i style="width:' + pct + '%"></i></div></div></div>' +
    (di.fb ? '<div class="callout warn">' + mi('warning') + '<span>Jenis mitra pengajuan ini belum terisi, sehingga yang ditampilkan hanya persyaratan umum.</span></div>' : '') +
    '<div class="dok-body"><nav class="dok-menu" aria-label="Daftar persyaratan">' + menu + '</nav>' + pane + '</div></div>';
}
function tChecklist(p, d) {
  const items = S.master.persyaratan[p.jenis_mitra] || []; const edit = can(['admin', 'uptd']) && p.tahap === 3 && FINAL.indexOf(p.status) === -1;
  const cl = {}; d.checklist.forEach(function (c) { cl[c.item] = c; });
  const done = items.filter(function (i) { return cl[i] && cl[i].status === 'Sesuai'; }).length;
  return '<div class="card"><h3>Checklist administrasi (Lampiran III)</h3><p class="sub">' + done + ' dari ' + items.length + ' persyaratan sesuai.</p><p class="hint" style="margin:4px 0 10px">Lampiran III adalah daftar periksa kelengkapan persyaratan administrasi yang diverifikasi PRL pada Tahap 3, sebelum usulan diteruskan ke verifikasi ruang/RPZ (Tahap 4). Tandai tiap persyaratan <b>Sesuai</b> atau <b>Tidak sesuai</b> berdasarkan berkas yang diunggah mitra.</p>' + (items.length ? '' : '<div class="callout warn">' + mi('warning') + '<span>Daftar persyaratan kosong karena jenis mitra pengajuan ini belum terisi. Periksa data pengajuan atau persyaratan di Data Master.</span></div>') + items.map(function (it, i) {
    const c = cl[it] || {}; const fs = d.berkas.filter(function (b) { return b.item === it; });
    return '<div class="ck"><div><div class="nm">' + esc(it) + '</div><div class="fl">' + (fs.length ? fs.map(function (b) { return fileChip(b, false); }).join('') : '<span class="t-sub">Belum ada berkas</span>') + '</div></div><div>' +
      (edit ? '<select class="in" data-ck="s" data-i="' + i + '"><option value="">— nilai —</option>' + NILAI.map(function (n) { return '<option' + (c.status === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select><input class="in" style="margin-top:6px" data-ck="c" data-i="' + i + '" placeholder="Catatan" value="' + esc(c.catatan || '') + '">' : (c.status ? '<span class="chip ' + (c.status === 'Sesuai' ? 'c-ok' : 'c-warn') + '">' + esc(c.status) + '</span><div class="t-sub">' + esc(c.catatan || '') + '</div>' : '<span class="chip c-draft">Belum dinilai</span>')) + '</div></div>';
  }).join('') + (edit ? '<div style="text-align:right;margin-top:12px"><button class="btn btn-p" data-act="saveCk">' + mi('save') + ' Simpan checklist</button></div>' : '') + '</div>';
}
function tTelaah(p, d) {
  const edit = can(['prl']) && (p.tahap === 4 || p.tahap === 5) && FINAL.indexOf(p.status) === -1;
  const tp = d.telaah_program || { data: {}, rekomendasi: '' }; const tb = d.telaah_pembiayaan || {};
  return '<div class="card" style="margin-bottom:16px"><h3>Telaah program (Lampiran IV/V)</h3><p class="sub">10 aspek penelaahan.</p>' + S.master.aspek.map(function (a, i) {
    const v = tp.data[a] || {};
    return '<div class="ck"><div class="nm">' + (i + 1) + '. ' + esc(a) + '</div><div>' + (edit ? '<select class="in" data-tp="s" data-a="' + esc(a) + '"><option value="">— nilai —</option>' + NILAI.map(function (n) { return '<option' + (v.status === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select><input class="in" style="margin-top:6px" data-tp="c" data-a="' + esc(a) + '" placeholder="Catatan" value="' + esc(v.catatan || '') + '">' : (v.status ? '<span class="chip ' + (v.status === 'Sesuai' ? 'c-ok' : 'c-warn') + '">' + esc(v.status) + '</span><div class="t-sub">' + esc(v.catatan || '') + '</div>' : '<span class="t-sub">-</span>')) + '</div></div>';
  }).join('') + '<div class="fld" style="margin-top:12px"><label>Rekomendasi</label>' + (edit ? '<textarea class="in" id="tpRek">' + esc(tp.rekomendasi || '') + '</textarea>' : '<div>' + esc(tp.rekomendasi || '-') + '</div>') + '</div>' + (edit ? '<div style="text-align:right"><button class="btn btn-p" data-act="saveTp">' + mi('save') + ' Simpan telaah program</button></div>' : '') + '</div>' +
    '<div class="card"><h3>Telaah pembiayaan</h3><p class="sub">Rencana dan porsi pembiayaan.</p>' + (edit ? '<div class="row2"><div class="fld"><label>Rencana biaya</label><input class="in" id="tbR" value="' + esc(tb.rencana_biaya || '') + '"></div><div class="fld"><label>Sumber</label><input class="in" id="tbS" value="' + esc(tb.sumber_pembiayaan || '') + '"></div></div><div class="row3"><div class="fld"><label>Porsi mitra</label><input class="in" id="tbM" value="' + esc(tb.porsi_mitra || '') + '"></div><div class="fld"><label>Porsi DKP</label><input class="in" id="tbD" value="' + esc(tb.porsi_dkp || '') + '"></div><div class="fld"><label>Porsi lain</label><input class="in" id="tbL" value="' + esc(tb.porsi_lain || '') + '"></div></div><div class="fld"><label>Rekomendasi</label><textarea class="in" id="tbRek">' + esc(tb.rekomendasi || '') + '</textarea></div><div style="text-align:right"><button class="btn btn-p" data-act="saveTb">' + mi('save') + ' Simpan telaah pembiayaan</button></div>' : '<dl class="kv"><dt>Rencana biaya</dt><dd>' + esc(tb.rencana_biaya || '-') + '</dd><dt>Sumber</dt><dd>' + esc(tb.sumber_pembiayaan || '-') + '</dd><dt>Porsi mitra / DKP / lain</dt><dd>' + esc(tb.porsi_mitra || '-') + ' / ' + esc(tb.porsi_dkp || '-') + ' / ' + esc(tb.porsi_lain || '-') + '</dd><dt>Rekomendasi</dt><dd>' + esc(tb.rekomendasi || '-') + '</dd></dl>') + '</div>';
}
const TTD_SLOTS = [
  { jenis: 'BA Pemaparan', judul: 'Berita Acara Pemaparan', tahap: [6, 7], ket: 'Hasil pindai BA yang sudah ditandatangani. Wajib sebelum tahap Pemaparan ditandai selesai.', tgl: true },
  { jenis: 'BA Hasil Penelaahan', judul: 'Berita Acara Hasil Penelaahan', tahap: [7, 8], ket: 'Hasil pindai BA yang sudah ditandatangani. Wajib sebelum kesepakatan dicatat.', tgl: true },
  { jenis: 'Draft PKS', judul: 'Draft PKS', tahap: [9, 10, 11], ket: 'Naskah draf PKS (belum ditandatangani) untuk dilaporkan ke Dinas.', tgl: false },
  { jenis: 'PKS Bertanda Tangan', judul: 'PKS Bertanda Tangan', tahap: [11], ket: 'Hasil pindai PKS yang sudah ditandatangani para pihak. Wajib sebelum PKS dinyatakan ditandatangani.', tgl: true }
];
function ttdBerkas(d, jenis) { return (d.berkas || []).filter(function (b) { return b.item === '@TTD:' + jenis; })[0]; }
function tBA(p, d) {
  const fin = FINAL.indexOf(p.status) === -1;
  const slot = function (c) {
    const b = ttdBerkas(d, c.jenis); const win = c.tahap.indexOf(p.tahap) > -1 || isSuper(); const edit = fin && win && can(c.jenis.indexOf('BA ') === 0 ? ['prl'] : ['admin', 'uptd']);
    const rec = c.jenis.indexOf('BA ') === 0 ? d.ba.filter(function (x) { return x.jenis === c.jenis.substr(3); })[0] : d.pks[0];
    const id = 'tt' + c.jenis.replace(/\W/g, '');
    const form = edit ? '<div class="fld" style="margin-top:12px"><label>' + (b ? 'Ganti berkas' : 'Unggah berkas') + ' (hanya PDF, maks. 8 MB)</label><input type="file" class="in" id="' + id + 'F" accept=".pdf,application/pdf"></div>' +
      '<div class="row2">' + (c.tgl ? '<div class="fld"><label>Tanggal penandatanganan <i>*</i></label><input type="date" class="in" id="' + id + 'T" value="' + esc(rec && rec.tanggal ? String(rec.tanggal).substr(0, 10) : '') + '"></div>' : '') + '<div class="fld"><label>Nomor dokumen</label><input class="in" id="' + id + 'N" value="' + esc(rec && rec.nomor ? rec.nomor : '') + '" placeholder="Opsional"></div></div>' +
      '<div class="fld"><label>Catatan</label><input class="in" id="' + id + 'C" value="' + esc(c.jenis.indexOf('BA ') === 0 && rec ? rec.kesimpulan || '' : '') + '"></div>' +
      '<div style="text-align:right"><button class="btn btn-p" data-act="ttdUp" data-j="' + esc(c.jenis) + '">' + mi('upload_file') + ' ' + (b ? 'Ganti berkas' : 'Unggah') + '</button></div>' : '';
    return '<div class="card" style="margin-bottom:16px"><h3>' + esc(c.judul) + ' ' + (b ? '<span class="chip c-ok">Terunggah</span>' : '<span class="chip c-draft">Belum diunggah</span>') + '</h3><p class="sub">' + esc(c.ket) + '</p>' +
      (b ? '<div class="dok-files">' + fileChip(b, false) + '</div>' + (rec && rec.nomor ? '<dl class="kv"><dt>Nomor</dt><dd>' + esc(rec.nomor) + '</dd>' + (c.tgl && rec.tanggal ? '<dt>Tanggal</dt><dd>' + fmtD(rec.tanggal) + '</dd>' : '') + '</dl>' : '') : '<p class="hint">Belum ada berkas.</p>') + form + '</div>';
  };
  const k = d.pks[0]; const kedit = can(['admin', 'uptd', 'kepala_dkp']) && [9, 10, 11].indexOf(p.tahap) > -1 && !(k && k.status === 'Ditandatangani');
  const lapor = '<div class="row2"><div class="fld"><label>Tanggal lapor ke Dinas Kelautan dan Perikanan Provinsi Sulawesi Tengah</label><input type="date" class="in" id="pkLapor" value="' + esc(k && k.tgl_lapor_gubernur ? String(k.tgl_lapor_gubernur).substr(0, 10) : '') + '"></div><div class="fld"><label>Bukti pelaporan (nomor/uraian)</label><input class="in" id="pkBukti" value="' + esc(k ? k.bukti_lapor : '') + '"></div></div>';
  const meta = '<div class="card"><h3>Data PKS ' + (k ? '<span class="chip ' + (k.status === 'Ditandatangani' ? 'c-ok' : 'c-draft') + '">' + esc(k.status) + '</span>' : '') + '</h3><p class="sub">' + (k ? esc(k.nomor) + (k.status === 'Ditandatangani' ? ' · Kode verifikasi: <b>' + esc(k.kode) + '</b>' : '') : 'Belum disusun') + '</p>' +
    (kedit ? (p.tahap === 10 || S.me.peran === 'kepala_dkp' ? '' : '<div class="fld"><label>Para pihak</label><input class="in" id="pkPihak" value="' + esc(k ? k.para_pihak : '') + '"></div><div class="fld"><label>Ruang lingkup</label><textarea class="in" id="pkRuang">' + esc(k ? k.ruang_lingkup : '') + '</textarea></div><div class="fld"><label>Masa berlaku</label><input class="in" id="pkMasa" value="' + esc(k ? k.masa_berlaku : '') + '"></div>') +
      (can(['kepala_dkp']) ? lapor : '') + '<div style="text-align:right"><button class="btn btn-p" data-act="savePks">' + mi('save') + ' Simpan data PKS</button></div>'
      : (k ? '<dl class="kv"><dt>Para pihak</dt><dd>' + esc(k.para_pihak || '-') + '</dd><dt>Ruang lingkup</dt><dd>' + esc(k.ruang_lingkup || '-') + '</dd><dt>Masa berlaku</dt><dd>' + esc(k.masa_berlaku || '-') + '</dd><dt>Lapor ke Dinas Kelautan dan Perikanan Provinsi</dt><dd>' + (k.tgl_lapor_gubernur ? fmtD(k.tgl_lapor_gubernur) + ' · ' + esc(k.bukti_lapor || '') : '-') + '</dd></dl>' : '<span class="t-sub">-</span>')) + '</div>';
  return '<div class="callout info" style="margin-bottom:16px">' + mi('info') + '<span>Berita Acara dan PKS ditandatangani secara offline. Unggah hasil pindainya di sini; dokumen yang bertanda tangan menjadi syarat untuk melanjutkan tahap.</span></div>' + TTD_SLOTS.map(slot).join('') + meta;
}
function monevFile(m, d) { if (m.file) return m.file; const b = ((d && d.berkas) || []).filter(function (x) { return x.item === '@MONEV:' + m.id; })[0]; return b || null; }
function tMonev(p, d) {
  const bisa = p.tahap === 12 && p.status !== 'Selesai' && can(['mitra', 'admin', 'uptd']);
  const list = d.monev.map(function (m) { return '<div class="it" style="padding:10px 0;border-bottom:1px solid var(--line)"><b>' + esc(m.periode) + '</b> <span class="chip c-teal">' + esc(m.capaian_persen) + '%</span><div class="t-sub">' + esc(m.pelapor) + ' · ' + fmtD(m.dibuat) + '</div><div>' + esc(m.kendala || '') + '</div>' + (monevFile(m, d) ? '<div class="dok-files" style="margin-top:6px">' + fileChip(monevFile(m, d), false) + '</div>' : '') + (m.rekomendasi ? '<div class="t-sub">Rekomendasi: ' + esc(m.rekomendasi) + '</div>' : '') + '</div>'; }).join('') || '<div class="empty" style="padding:18px">Belum ada laporan.</div>';
  return '<div class="grid g-main"><div class="card"><h3>Laporan monitoring (Lampiran VIII)</h3><p class="sub">Terbaru di atas.</p>' + list + '</div>' + (bisa ? '<div class="card"><h3>Tambah laporan</h3><div class="fld"><label>Periode <i>*</i></label><input class="in" id="mvP" placeholder="mis. Triwulan I 2027"></div><div class="fld"><label>Target</label><input class="in" id="mvT"></div><div class="row2"><div class="fld"><label>Capaian (%)</label><input type="number" min="0" max="100" class="in" id="mvC"></div><div class="fld"><label>Realisasi biaya</label><input class="in" id="mvR"></div></div><div class="fld"><label>Kendala</label><textarea class="in" id="mvK"></textarea></div><div class="fld"><label>Rekomendasi</label><textarea class="in" id="mvRek"></textarea></div><div class="fld"><label>Berkas laporan monev (hanya PDF, maks. 8 MB)' + (S.me.peran === 'mitra' ? '' : ' <i>*</i>') + '</label><input type="file" class="in" id="mvF" accept=".pdf,application/pdf"></div><button class="btn btn-p btn-block" data-act="saveMv">' + mi('add') + ' Kirim laporan</button></div>' : '') + '</div>';
}
function tRiwayat(p, d) {
  return '<div class="card"><h3>Jejak audit</h3><p class="sub">Setiap keputusan dicatat permanen.</p><div class="tl">' + (d.riwayat.map(function (r) { return '<div class="it ' + (/Tidak/.test(r.keputusan) ? 'bad' : '') + '"><b>' + esc(r.keputusan) + '</b> <span class="t-sub">(tahap ' + esc(r.dari) + ' → ' + esc(r.ke) + ')</span><small>' + esc(r.pelaku) + ' · ' + esc(PERAN_L(r.peran)) + ' · ' + fmtDT(r.waktu) + '</small>' + (r.catatan ? '<div class="note">' + esc(r.catatan) + '</div>' : '') + '</div>'; }).join('') || '<div class="empty">Belum ada riwayat.</div>') + '</div></div>';
}
function PERAN_L(r) { return { mitra: 'Mitra', prl: 'PRL', uptd: 'UPTD', kepala_dkp: 'Kepala DKP', admin: 'Admin UPTD', superadmin: 'Super Admin' }[r] || r; }

function jadwalTeks(j) { return esc(fmtD(j.tanggal)) + ', ' + esc(j.jam) + (j.jam_selesai ? '–' + esc(j.jam_selesai) : '') + ' WITA' + (j.tempat ? ' · ' + esc(j.tempat) : ''); }
function tJadwal(p, d) {
  const j = d.jadwal; const edit = can(['prl']) && p.tahap === 6 && FINAL.indexOf(p.status) === -1;
  const tag = j ? '<span class="chip ' + (j.status === 'Dibatalkan' ? 'c-bad' : 'c-ok') + '">' + esc(j.status) + '</span>' : '';
  const view = j ? '<div class="callout ' + (j.status === 'Dibatalkan' ? 'bad' : 'ok') + '" style="margin:10px 0">' + mi('event') + '<span>' + jadwalTeks(j) + '</span></div><dl class="kv"><dt>Tempat</dt><dd>' + esc(j.tempat || '-') + '</dd><dt>Rapat daring</dt><dd>' + (j.tautan ? '<a href="' + esc(j.tautan) + '" target="_blank" rel="noopener noreferrer">' + esc(j.tautan) + '</a>' : '-') + '</dd><dt>Peserta</dt><dd>' + esc(j.peserta || '-') + '</dd><dt>Catatan</dt><dd>' + esc(j.catatan || '-') + '</dd><dt>Ditetapkan</dt><dd>' + esc(j.dibuat_oleh) + ' · ' + fmtDT(j.diubah) + '</dd></dl>' + (isStaff() ? '<div style="margin:10px 0"><button class="btn btn-o btn-s" data-act="jdWa">' + mi('chat') + ' Kirim lewat WhatsApp (manual)</button><span class="t-sub" style="margin-left:8px">Buka WhatsApp dengan pesan jadwal yang sudah terisi.</span></div>' : '') : '<div class="empty" style="padding:18px">' + mi('event_busy') + 'Jadwal pemaparan belum ditentukan.</div>';
  const form = edit ? '<h4 style="margin:16px 0 8px">' + (j && j.status !== 'Dibatalkan' ? 'Ubah jadwal' : 'Tentukan jadwal') + '</h4><div class="row2"><div class="fld"><label>Tanggal <i>*</i></label><input type="date" class="in" id="jdT" min="' + new Date().toISOString().slice(0, 10) + '" value="' + esc(j && j.status !== 'Dibatalkan' ? String(j.tanggal).substr(0, 10) : '') + '"></div><div class="fld"><label>Jam mulai (WITA) <i>*</i></label><input type="time" class="in" id="jdJ" value="' + esc(j ? j.jam : '') + '"></div></div><div class="row2"><div class="fld"><label>Jam selesai</label><input type="time" class="in" id="jdJ2" value="' + esc(j ? j.jam_selesai : '') + '"></div><div class="fld"><label>Tempat</label><input class="in" id="jdP" placeholder="mis. Ruang rapat DKP" value="' + esc(j ? j.tempat : '') + '"></div></div><div class="fld"><label>Tautan rapat daring (opsional bila tempat diisi)</label><input class="in" id="jdL" placeholder="https://meet.google.com/…" value="' + esc(j ? j.tautan : '') + '"></div><div class="fld"><label>Peserta / undangan</label><input class="in" id="jdS" placeholder="PRL, UPTD, mitra, tim teknis…" value="' + esc(j ? j.peserta : '') + '"></div><div class="fld"><label>Catatan untuk mitra</label><textarea class="in" id="jdC" placeholder="Bahan paparan, durasi, perlengkapan…">' + esc(j ? j.catatan : '') + '</textarea></div><div style="display:flex;gap:8px;justify-content:flex-end">' + (j && j.status !== 'Dibatalkan' ? '<button class="btn btn-o" data-act="batalJadwal">Batalkan jadwal</button>' : '') + '<button class="btn btn-p" data-act="saveJadwal">' + mi('event_available') + ' Simpan jadwal</button></div><p class="hint" style="margin-top:8px">Mitra dan staf terkait mendapat notifikasi. Jadwal wajib ada sebelum pemaparan ditandai selesai.</p>' : '';
  return '<div class="card"><h3>Jadwal pemaparan program ' + tag + '</h3><p class="sub">Tahap 6 — presentasi program kepada tim PRL dan UPTD</p>' + view + form + '</div>';
}

/** Hasil WhatsApp setelah jadwal ditetapkan/dibatalkan: masuk antrean otomatis (token Fonnte aktif) atau tombol sekali-klik (wa.me). */
function waHasil(w) {
  if (!w || !w.penerima || !w.penerima.length) return;
  const q = w.mode === 'antrian'; const antri = w.penerima.filter(function (x) { return x.status === 'antri'; }).length;
  const sisa = w.penerima.filter(function (x) { return !(q && x.status === 'antri'); });
  if (q && !sisa.length) { toast('ok', 'WhatsApp masuk antrean untuk ' + antri + ' penerima, terkirim otomatis dalam ±1 menit.'); return; }
  const rows = w.penerima.map(function (x) {
    let st;
    if (q && x.status === 'antri') st = '<span class="chip c-ok">Dalam antrean</span>';
    else if (!x.nomor) st = '<span class="chip c-bad">Nomor belum diisi</span>';
    else st = '<a class="btn btn-p btn-s" target="_blank" rel="noopener" href="' + esc(x.link) + '">Kirim lewat WhatsApp</a>';
    return '<div class="wa-row"><div><b>' + esc(x.nama) + '</b><small>' + esc(x.peran_nama) + (x.nomor ? ' · +' + esc(x.nomor) : '') + '</small></div>' + st + '</div>';
  }).join('');
  modal({ title: q ? 'WhatsApp: ' + antri + ' dalam antrean, ' + sisa.length + ' perlu tindakan' : 'Kirim jadwal lewat WhatsApp', sub: q ? '' : 'Pengiriman otomatis belum aktif (Super Admin: Data Master → Notifikasi). Klik tombol di tiap penerima; pesan sudah terisi.',
    body: '<div class="wa-list">' + rows + '</div><p class="hint" style="margin-top:10px">Nomor diambil dari data pengguna. Lengkapi nomor yang kosong di Manajemen Pengguna.</p>', ok: 'Selesai', hideCancel: true });
}
