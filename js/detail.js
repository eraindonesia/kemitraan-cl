/* ----------------------------- Form Lampiran II (wizard 5 langkah) ----------------------------- */
const WSTEPS = ['Identitas Mitra', 'Program', 'Lokasi', 'Pembiayaan', 'Tinjau'];
function vForm() {
  const id = S.params.id; setTitle(id ? 'Ubah Pengajuan' : 'Ajukan Kemitraan');
  if (!S.wiz || S.wiz.editId !== (id || null)) {
    const p = id && pById(id); const saved = !id && LS.get('sm_form');
    S.wiz = { step: 0, editId: id || null, data: p ? { judul: p.judul, uraian: p.uraian, jangka: p.jangka, kawasan: p.kawasan, zona: p.zona, lokasi: p.lokasi, luas: p.luas, biaya: p.biaya, sumber: p.sumber } : (saved || {}) };
  }
  if (S.me.peran === 'admin' && !S.users) api('daftar_user').then(function (u) { S.users = u; if (S.view === 'form') renderWiz(); }).catch(function () {});
  setView('<div class="ph"><div><h2>' + (id ? 'Ubah pengajuan' : 'Formulir Pengajuan (Lampiran II)') + '</h2><p>Isi data program kemitraan. Draft tersimpan otomatis di perangkat ini.</p></div></div><div class="card" id="wizBox"></div>');
  renderWiz();
}
function renderWiz() {
  MapKit.disposeAll(); S.wizEd = null;
  const w = S.wiz, d = w.data, st = w.step; const f = function (k) { return esc(d[k] === undefined ? '' : d[k]); };
  let c = '';
  if (st === 0) {
    if (S.me.peran === 'admin') c = '<div class="fld"><label>Mitra pemilik pengajuan <i>*</i></label><select class="in" data-f="id_user"><option value="">Pilih mitra…</option>' + (S.users || []).filter(function (u) { return u.peran === 'mitra' && u.aktif; }).map(function (u) { return '<option value="' + esc(u.id) + '"' + (d.id_user === u.id ? ' selected' : '') + '>' + esc(u.lembaga + ' — ' + u.nama) + '</option>'; }).join('') + '</select></div>';
    else c = '<dl class="kv"><dt>Lembaga</dt><dd>' + esc(S.me.lembaga) + '</dd><dt>Jenis mitra</dt><dd>' + esc(jenisNama(S.me.jenis_mitra)) + '</dd><dt>Penanggung jawab</dt><dd>' + esc(S.me.nama) + '</dd><dt>Email</dt><dd>' + esc(S.me.email) + '</dd></dl><div class="callout info" style="margin-top:14px">' + mi('info') + '<span>Data identitas diambil dari akun Anda. Ubah melalui administrator bila keliru.</span></div>';
  } else if (st === 1) {
    c = '<div class="fld"><label>Judul / nama program <i>*</i></label><input class="in" data-f="judul" value="' + f('judul') + '"></div>' +
      '<div class="fld"><label>Uraian program <i>*</i> <span class="hint" id="wc">(' + words(d.uraian) + '/500 kata)</span></label><textarea class="in" data-f="uraian" rows="6">' + f('uraian') + '</textarea></div>' +
      '<div class="fld"><label>Jangka waktu kemitraan</label><input class="in" data-f="jangka" placeholder="mis. 3 Tahun" value="' + f('jangka') + '"></div>';
  } else if (st === 2) {
    const k = S.master.kawasan.filter(function (x) { return x.nama === d.kawasan; })[0]; const zs = k ? k.zona : [];
    c = '<div class="row2"><div class="fld"><label>Kawasan konservasi <i>*</i></label><select class="in" data-f="kawasan"><option value="">Pilih kawasan…</option>' + S.master.kawasan.map(function (x) { return '<option' + (d.kawasan === x.nama ? ' selected' : '') + '>' + esc(x.nama) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label>Zona <i>*</i></label><select class="in" data-f="zona"><option value="">Pilih zona…</option>' + zs.map(function (z) { return '<option' + (d.zona === z ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="fld"><label>Lokasi / area kegiatan <i>*</i></label><input class="in" data-f="lokasi" value="' + f('lokasi') + '"></div><div class="fld"><label>Luas area</label><input class="in" data-f="luas" placeholder="mis. 25 Ha" value="' + f('luas') + '"></div>';
    if (!w.editId) { c += '<div class="fld"><label>Area pengelolaan (opsional)</label><p class="hint">Gambar poligon area yang diusulkan, atau impor GeoJSON / daftar koordinat. Dapat ditambah atau diubah nanti pada tab Peta Area.</p><div id="wizMap"></div></div>'; setTimeout(wizMapInit, 0); }
  } else if (st === 3) {
    c = '<div class="row2"><div class="fld"><label>Total rencana anggaran (Rp)</label><input class="in" type="number" min="0" data-f="biaya" value="' + f('biaya') + '"></div><div class="fld"><label>Sumber pembiayaan</label><input class="in" data-f="sumber" placeholder="Swadaya / CSR / hibah…" value="' + f('sumber') + '"></div></div>' +
      '<div class="callout info">' + mi('attach_file') + '<span>Dokumen persyaratan diunggah pada halaman detail setelah draft disimpan.</span></div>';
  } else {
    const req = (S.master.persyaratan[S.me.jenis_mitra] || []);
    c = '<dl class="kv"><dt>Judul</dt><dd>' + f('judul') + '</dd><dt>Kawasan / zona</dt><dd>' + f('kawasan') + ' / ' + f('zona') + '</dd><dt>Lokasi</dt><dd>' + f('lokasi') + ' (' + f('luas') + ')</dd><dt>Jangka</dt><dd>' + f('jangka') + '</dd><dt>Anggaran</dt><dd>' + rp(d.biaya) + ' · ' + f('sumber') + '</dd><dt>Uraian</dt><dd>' + f('uraian') + '</dd></dl>' +
      (req.length && S.me.peran === 'mitra' ? '<h3 style="margin:16px 0 6px">Dokumen yang perlu disiapkan</h3><ul style="padding-left:18px;color:var(--tx-2)">' + req.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '');
    if (d.area && d.area.geojson) c += '<p class="t-sub" style="margin-top:10px">Area peta: ' + numID(MapKit.areaHa(MapKit.parse(d.area.geojson))) + ' Ha</p>';
  }
  $('wizBox').innerHTML = '<div class="wiz-h">' + WSTEPS.map(function (s, i) { return '<span class="' + (i <= st ? 'on' : '') + '">' + (i + 1) + '. ' + s + '</span>'; }).join('') + '</div><div class="wiz">' + WSTEPS.map(function (s, i) { return '<div class="' + (i <= st ? 'on' : '') + '"></div>'; }).join('') + '</div>' + c +
    '<div id="wErr" class="errtxt" role="alert"></div><div class="act-bar" style="position:static;box-shadow:none;border:0;padding:12px 0 0"><button class="btn btn-o" data-act="wBack">' + (st ? 'Kembali' : 'Batal') + '</button><div class="sp"></div>' +
    (st === 4 ? '<button class="btn btn-p" data-act="wSave">' + mi('save') + ' ' + (w.editId ? 'Simpan perubahan' : 'Simpan draft') + '</button>' : '<button class="btn btn-p" data-act="wNext">Lanjut ' + mi('arrow_forward') + '</button>') + '</div>';
}
function wizMapInit() {
  const el = $('wizMap'); if (!el || S.view !== 'form' || !S.wiz || S.wiz.step !== 2) return; const d = S.wiz.data;
  const ed = MapKit.editor(el, { geom: d.area && d.area.geojson, kawasan: d.kawasan, batas: S.peta ? S.peta.batas : [], maxChars: 40000,
    onChange: function (g) { d.area = g ? { nama: 'Area 1', geojson: g } : null; LS.set('sm_form', d); } });
  S.wizEd = ed; if (!S.peta && ed) loadPeta().then(function () { if (S.wizEd === ed) ed.setBatas(S.peta.batas); }).catch(function () {});
}
function wizValidate(st) {
  const d = S.wiz.data;
  if (st === 0 && S.me.peran === 'admin' && !d.id_user) return 'Pilih mitra pemilik pengajuan.';
  if (st === 1) { if (!(d.judul || '').trim() || !(d.uraian || '').trim()) return 'Judul dan uraian program wajib diisi.'; if (words(d.uraian) > 500) return 'Uraian maksimal 500 kata.'; }
  if (st === 2 && (!d.kawasan || !d.zona || !(d.lokasi || '').trim())) return 'Kawasan, zona, dan lokasi wajib diisi.';
  if (st === 3 && d.biaya !== undefined && d.biaya !== '' && Number(d.biaya) < 0) return 'Anggaran tidak boleh negatif.';
  return '';
}
function wizSave() {
  const w = S.wiz; const d = Object.assign({}, w.data); d.biaya = d.biaya === undefined ? '' : d.biaya; const now = new Date().toISOString();
  if (w.editId) {
    const before = Object.assign({}, pById(w.editId)); replaceP(Object.assign({}, before, d, { diubah: now }));
    toast('ok', 'Perubahan disimpan.'); S.wiz = null; navigateTo('detail', { id: before.id }, { replace: true });
    bg('Simpan perubahan', function () { d.id = before.id; return api('ubah', d).then(function (r) { replaceP(r); delete S.det[r.id]; }); }, function () { replaceP(before); });
    return;
  }
  const tmp = { id: 'tmp_' + Date.now(), nomor: 'Menyimpan…', id_user: S.me.id, lembaga: S.me.lembaga, jenis_mitra: S.me.jenis_mitra, judul: d.judul, kawasan: d.kawasan, zona: d.zona, lokasi: d.lokasi, luas: d.luas || '', uraian: d.uraian, biaya: d.biaya, sumber: d.sumber || '', jangka: d.jangka || '', tahap: 1, status: 'Draft', dibuat: now, diubah: now, diubah_oleh: S.me.nama, _pending: true };
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
function canUploadDoc(p) { if (FINAL.indexOf(p.status) > -1) return false; if (S.me.peran === 'mitra') return p.id_user === S.me.id && p.tahap === 1 && (p.status === 'Draft' || p.status === 'Perlu dilengkapi'); return true; }
function canEditP(p) { return S.me.peran !== 'prl' && S.me.peran !== 'uptd' && S.me.peran !== 'kepala_dkp' && p.tahap === 1 && (p.status === 'Draft' || p.status === 'Perlu dilengkapi') && (S.me.peran === 'admin' || p.id_user === S.me.id); }
function tabsFor(p) {
  const t = [['ringkasan', 'Ringkasan'], ['dokumen', 'Dokumen']];
  if (isStaff() || p.tahap > 3) t.push(['checklist', 'Checklist Administrasi (L-III)']);
  if (isStaff() || p.tahap > 4) t.push(['telaah', 'Telaah (L-IV/V)']);
  t.push(['peta', 'Peta Area']); t.push(['ba', 'BA & PKS']); if (p.tahap === 12 || (detData() && detData().monev.length)) t.push(['monev', 'Monev']); t.push(['riwayat', 'Riwayat']); return t;
}
function renderDetailBody() {
  MapKit.disposeAll();
  const p = pById(S.params.id); if (!p) return; const d = detData();
  $('dTitle').textContent = p.judul; $('dSub').textContent = p.nomor + ' · ' + p.lembaga + ' · ' + p.kawasan; $('dChip').innerHTML = chip(p);
  const tabs = tabsFor(p); if (!tabs.some(function (t) { return t[0] === S.tab; })) S.tab = 'ringkasan';
  const stepper = '<div class="card"><div class="stepper">' + S.master.stages.map(function (s) { const stop = p.status === 'Tidak dilanjutkan' && s.no === p.tahap; const cl = stop ? 'stop' : (p.status === 'Selesai' || s.no < p.tahap) ? 'done' : s.no === p.tahap ? 'now' : ''; return '<div class="stp ' + cl + '" title="' + esc(s.nama) + '"><div class="n">' + (cl === 'done' ? mi('check', 'font-size:16px') : stop ? mi('close', 'font-size:16px') : s.no) + '</div><small>' + esc(SHORT[s.no - 1]) + '</small></div>'; }).join('') + '</div></div>';
  const ops = opsiFor(p);
  const bar = ops.length || canEditP(p) ? '<div class="act-bar"><span class="t-sub">' + mi('bolt', 'font-size:16px') + ' Tahap ' + p.tahap + ': ' + esc(stageName(p.tahap)) + '</span><div class="sp"></div>' + (canEditP(p) ? '<button class="btn btn-o" data-act="editP" data-id="' + esc(p.id) + '">' + mi('edit') + ' Ubah data</button>' : '') + ops.map(function (t) { const bad = /Tidak/.test(t.k); return '<button class="btn ' + (bad ? 'btn-w' : 'btn-p') + '" data-act="maju" data-k="' + esc(t.k) + '">' + esc(t.k) + '</button>'; }).join('') + '</div>' : '';
  $('dBody').innerHTML = stepper + '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button class="' + (S.tab === t[0] ? 'on' : '') + '" role="tab" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="tabBody">' + tabHtml(p, d) + '</div>' + bar;
  afterDetailRender();
}
function skel() { return '<div class="card"><div class="sk" style="width:40%;margin-bottom:12px"></div><div class="sk" style="margin-bottom:8px"></div><div class="sk" style="width:80%;margin-bottom:8px"></div><div class="sk" style="width:60%"></div></div>'; }
function tabHtml(p, d) {
  if (S.tab === 'ringkasan') return tRingkasan(p, d);
  if (!d) return skel();
  return ({ dokumen: tDokumen, checklist: tChecklist, telaah: tTelaah, ba: tBA, monev: tMonev, riwayat: tRiwayat, peta: tPeta }[S.tab] || tRingkasan)(p, d);
}
function tRingkasan(p, d) {
  let warn = '';
  if (p.status === 'Perlu dilengkapi' && d) { const r = d.riwayat.filter(function (x) { return x.keputusan === 'Tidak Lengkap'; })[0]; warn = '<div class="callout warn">' + mi('warning') + '<span><b>Perlu dilengkapi.</b> ' + esc(r ? r.catatan : 'Lengkapi dokumen sesuai catatan verifikator.') + '</span></div>'; }
  else if (p.status === 'Perlu dilengkapi') warn = '<div class="callout warn">' + mi('warning') + '<span><b>Perlu dilengkapi.</b> Lihat catatan pada tab Riwayat.</span></div>';
  if (p.status === 'Tidak dilanjutkan') warn = '<div class="callout bad">' + mi('block') + '<span>Pengajuan tidak dilanjutkan.</span></div>';
  return warn + '<div class="grid g-main"><div class="card"><h3>Data program</h3><p class="sub">Lampiran II</p><dl class="kv"><dt>Lembaga</dt><dd>' + esc(p.lembaga) + '</dd><dt>Jenis mitra</dt><dd>' + esc(jenisNama(p.jenis_mitra)) + '</dd><dt>Kawasan / zona</dt><dd>' + esc(p.kawasan) + ' / ' + esc(p.zona) + '</dd><dt>Lokasi</dt><dd>' + esc(p.lokasi) + ' ' + (p.luas ? '(' + esc(p.luas) + ')' : '') + '</dd><dt>Jangka waktu</dt><dd>' + esc(p.jangka || '-') + '</dd><dt>Anggaran</dt><dd>' + rp(p.biaya) + ' · ' + esc(p.sumber || '-') + '</dd><dt>Uraian</dt><dd style="white-space:pre-wrap">' + esc(p.uraian) + '</dd></dl></div>' +
    '<div class="card"><h3>Status</h3><p class="sub">Posisi saat ini</p><dl class="kv" style="grid-template-columns:100px 1fr"><dt>Tahap</dt><dd>' + p.tahap + '/12 — ' + esc(stageName(p.tahap)) + '</dd><dt>Status</dt><dd>' + chip(p) + '</dd><dt>Dibuat</dt><dd>' + fmtD(p.dibuat) + '</dd><dt>Diperbarui</dt><dd>' + fmtDT(p.diubah) + '<br><span class="t-sub">oleh ' + esc(p.diubah_oleh) + '</span></dd><dt>Pelaku tahap</dt><dd>' + esc((S.master.stages[p.tahap - 1] || {}).pelaku || '') + '</dd></dl></div></div>';
}
function fileChip(b, del) { return '<span class="file">' + mi('description', 'font-size:15px') + '<a href="#" data-act="dl" data-id="' + esc(b.id) + '">' + esc(b.nama) + '</a><span class="t-sub">' + Math.round((b.ukuran || 0) / 1024) + ' KB</span>' + (del ? '<button data-act="delFile" data-id="' + esc(b.id) + '" aria-label="Hapus berkas">' + mi('close', 'font-size:15px') + '</button>' : '') + '</span>'; }
function tDokumen(p, d) {
  const req = (S.master.persyaratan[p.jenis_mitra] || []).concat(['Lainnya']); const up = canUploadDoc(p);
  return '<div class="card"><h3>Dokumen persyaratan</h3><p class="sub">PDF, JPG, PNG, DOCX, XLSX · maks. 8 MB per berkas.</p>' + req.map(function (it, i) {
    const fs = d.berkas.filter(function (b) { return b.item === it; });
    return '<div class="ck" style="grid-template-columns:1fr auto"><div><div class="nm">' + esc(it) + ' ' + (fs.length ? '<span class="chip c-ok">' + mi('check', 'font-size:14px') + ' ' + fs.length + ' berkas</span>' : (it === 'Lainnya' ? '' : '<span class="chip c-draft">Belum ada</span>')) + '</div><div class="fl">' + fs.map(function (b) { return fileChip(b, up); }).join('') + '</div></div>' +
      (up ? '<div><input type="file" id="fu' + i + '" data-item="' + esc(it) + '" data-chg="upload" hidden accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"><label for="fu' + i + '" class="btn btn-o btn-s" tabindex="0">' + mi('upload') + ' Unggah</label></div>' : '') + '</div>';
  }).join('') + '</div>';
}
function tChecklist(p, d) {
  const items = S.master.persyaratan[p.jenis_mitra] || []; const edit = (S.me.peran === 'prl' || S.me.peran === 'admin') && p.tahap === 3 && FINAL.indexOf(p.status) === -1;
  const cl = {}; d.checklist.forEach(function (c) { cl[c.item] = c; });
  const done = items.filter(function (i) { return cl[i] && cl[i].status === 'Sesuai'; }).length;
  return '<div class="card"><h3>Checklist administrasi (Lampiran III)</h3><p class="sub">' + done + ' dari ' + items.length + ' persyaratan sesuai.</p><p class="hint" style="margin:4px 0 10px">Lampiran III adalah daftar periksa kelengkapan persyaratan administrasi yang diverifikasi PRL pada Tahap 3, sebelum usulan diteruskan ke verifikasi ruang/RPZ (Tahap 4). Tandai tiap persyaratan <b>Sesuai</b> atau <b>Tidak sesuai</b> berdasarkan berkas yang diunggah mitra.</p>' + (items.length ? '' : '<div class="callout warn">' + mi('warning') + '<span>Daftar persyaratan kosong karena jenis mitra pengajuan ini belum terisi. Periksa data pengajuan atau persyaratan di Data Master.</span></div>') + items.map(function (it, i) {
    const c = cl[it] || {}; const fs = d.berkas.filter(function (b) { return b.item === it; });
    return '<div class="ck"><div><div class="nm">' + esc(it) + '</div><div class="fl">' + (fs.length ? fs.map(function (b) { return fileChip(b, false); }).join('') : '<span class="t-sub">Belum ada berkas</span>') + '</div></div><div>' +
      (edit ? '<select class="in" data-ck="s" data-i="' + i + '"><option value="">— nilai —</option>' + NILAI.map(function (n) { return '<option' + (c.status === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select><input class="in" style="margin-top:6px" data-ck="c" data-i="' + i + '" placeholder="Catatan" value="' + esc(c.catatan || '') + '">' : (c.status ? '<span class="chip ' + (c.status === 'Sesuai' ? 'c-ok' : 'c-warn') + '">' + esc(c.status) + '</span><div class="t-sub">' + esc(c.catatan || '') + '</div>' : '<span class="chip c-draft">Belum dinilai</span>')) + '</div></div>';
  }).join('') + (edit ? '<div style="text-align:right;margin-top:12px"><button class="btn btn-p" data-act="saveCk">' + mi('save') + ' Simpan checklist</button></div>' : '') + '</div>';
}
function tTelaah(p, d) {
  const edit = ['prl', 'uptd', 'admin'].indexOf(S.me.peran) > -1 && (p.tahap === 4 || p.tahap === 5) && FINAL.indexOf(p.status) === -1;
  const tp = d.telaah_program || { data: {}, rekomendasi: '' }; const tb = d.telaah_pembiayaan || {};
  return '<div class="card" style="margin-bottom:16px"><h3>Telaah program (Lampiran IV/V)</h3><p class="sub">10 aspek penelaahan.</p>' + S.master.aspek.map(function (a, i) {
    const v = tp.data[a] || {};
    return '<div class="ck"><div class="nm">' + (i + 1) + '. ' + esc(a) + '</div><div>' + (edit ? '<select class="in" data-tp="s" data-a="' + esc(a) + '"><option value="">— nilai —</option>' + NILAI.map(function (n) { return '<option' + (v.status === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select><input class="in" style="margin-top:6px" data-tp="c" data-a="' + esc(a) + '" placeholder="Catatan" value="' + esc(v.catatan || '') + '">' : (v.status ? '<span class="chip ' + (v.status === 'Sesuai' ? 'c-ok' : 'c-warn') + '">' + esc(v.status) + '</span><div class="t-sub">' + esc(v.catatan || '') + '</div>' : '<span class="t-sub">-</span>')) + '</div></div>';
  }).join('') + '<div class="fld" style="margin-top:12px"><label>Rekomendasi</label>' + (edit ? '<textarea class="in" id="tpRek">' + esc(tp.rekomendasi || '') + '</textarea>' : '<div>' + esc(tp.rekomendasi || '-') + '</div>') + '</div>' + (edit ? '<div style="text-align:right"><button class="btn btn-p" data-act="saveTp">' + mi('save') + ' Simpan telaah program</button></div>' : '') + '</div>' +
    '<div class="card"><h3>Telaah pembiayaan</h3><p class="sub">Rencana dan porsi pembiayaan.</p>' + (edit ? '<div class="row2"><div class="fld"><label>Rencana biaya</label><input class="in" id="tbR" value="' + esc(tb.rencana_biaya || '') + '"></div><div class="fld"><label>Sumber</label><input class="in" id="tbS" value="' + esc(tb.sumber_pembiayaan || '') + '"></div></div><div class="row3"><div class="fld"><label>Porsi mitra</label><input class="in" id="tbM" value="' + esc(tb.porsi_mitra || '') + '"></div><div class="fld"><label>Porsi DKP</label><input class="in" id="tbD" value="' + esc(tb.porsi_dkp || '') + '"></div><div class="fld"><label>Porsi lain</label><input class="in" id="tbL" value="' + esc(tb.porsi_lain || '') + '"></div></div><div class="fld"><label>Rekomendasi</label><textarea class="in" id="tbRek">' + esc(tb.rekomendasi || '') + '</textarea></div><div style="text-align:right"><button class="btn btn-p" data-act="saveTb">' + mi('save') + ' Simpan telaah pembiayaan</button></div>' : '<dl class="kv"><dt>Rencana biaya</dt><dd>' + esc(tb.rencana_biaya || '-') + '</dd><dt>Sumber</dt><dd>' + esc(tb.sumber_pembiayaan || '-') + '</dd><dt>Porsi mitra / DKP / lain</dt><dd>' + esc(tb.porsi_mitra || '-') + ' / ' + esc(tb.porsi_dkp || '-') + ' / ' + esc(tb.porsi_lain || '-') + '</dd><dt>Rekomendasi</dt><dd>' + esc(tb.rekomendasi || '-') + '</dd></dl>') + '</div>';
}
function tBA(p, d) {
  const stf = ['prl', 'uptd', 'admin'].indexOf(S.me.peran) > -1 && FINAL.indexOf(p.status) === -1;
  const baBox = function (jenis, tahaps) {
    const b = d.ba.filter(function (x) { return x.jenis === jenis; })[0]; const edit = stf && (S.me.peran === 'admin' || tahaps.indexOf(p.tahap) > -1) && !(b && b.status === 'Disahkan');
    return '<div class="card" style="margin-bottom:16px"><h3>Berita Acara ' + esc(jenis) + ' ' + (b ? '<span class="chip ' + (b.status === 'Disahkan' ? 'c-ok' : 'c-draft') + '">' + esc(b.status) + '</span>' : '') + '</h3><p class="sub">' + (b ? esc(b.nomor) : 'Belum disusun') + (b && b.status === 'Disahkan' ? ' · Kode verifikasi: <b>' + esc(b.kode) + '</b>' : '') + '</p>' +
      (edit ? '<div class="row2"><div class="fld"><label>Tanggal</label><input type="date" class="in" data-ba="' + esc(jenis) + '" data-k="tanggal" value="' + esc(b ? String(b.tanggal).substr(0, 10) : '') + '"></div><div class="fld"><label>Peserta</label><input class="in" data-ba="' + esc(jenis) + '" data-k="peserta" value="' + esc(b ? b.peserta : '') + '"></div></div><div class="fld"><label>Kesimpulan</label><textarea class="in" data-ba="' + esc(jenis) + '" data-k="kesimpulan">' + esc(b ? b.kesimpulan : '') + '</textarea></div><div style="text-align:right;display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-p" data-act="saveBA" data-j="' + esc(jenis) + '">' + mi('save') + ' Simpan</button>' + (b ? '<button class="btn btn-n" data-act="sahBA" data-id="' + esc(b.id) + '">' + mi('verified') + ' Sahkan</button>' : '') + '</div>'
        : (b ? '<dl class="kv"><dt>Tanggal</dt><dd>' + fmtD(b.tanggal) + '</dd><dt>Peserta</dt><dd>' + esc(b.peserta || '-') + '</dd><dt>Kesimpulan</dt><dd>' + esc(b.kesimpulan || '-') + '</dd></dl>' : '<span class="t-sub">-</span>')) + '</div>';
  };
  const k = d.pks[0]; const kedit = (['prl', 'uptd', 'kepala_dkp', 'admin'].indexOf(S.me.peran) > -1) && [9, 10, 11].indexOf(p.tahap) > -1 && !(k && k.status === 'Ditandatangani');
  const pks = '<div class="card"><h3>Perjanjian Kemitraan (PKS) ' + (k ? '<span class="chip ' + (k.status === 'Ditandatangani' ? 'c-ok' : 'c-draft') + '">' + esc(k.status) + '</span>' : '') + '</h3><p class="sub">' + (k ? esc(k.nomor) + (k.status === 'Ditandatangani' ? ' · Kode verifikasi: <b>' + esc(k.kode) + '</b>' : '') : 'Belum disusun') + '</p>' +
    (kedit ? (S.me.peran === 'kepala_dkp' ? '' : '<div class="fld"><label>Para pihak</label><input class="in" id="pkPihak" value="' + esc(k ? k.para_pihak : '') + '"></div><div class="fld"><label>Ruang lingkup</label><textarea class="in" id="pkRuang">' + esc(k ? k.ruang_lingkup : '') + '</textarea></div><div class="fld"><label>Masa berlaku</label><input class="in" id="pkMasa" value="' + esc(k ? k.masa_berlaku : '') + '"></div>') +
      (['kepala_dkp', 'admin'].indexOf(S.me.peran) > -1 ? '<div class="row2"><div class="fld"><label>Tanggal lapor ke Gubernur</label><input type="date" class="in" id="pkLapor" value="' + esc(k ? String(k.tgl_lapor_gubernur).substr(0, 10) : '') + '"></div><div class="fld"><label>Bukti pelaporan (nomor/uraian)</label><input class="in" id="pkBukti" value="' + esc(k ? k.bukti_lapor : '') + '"></div></div>' : '') + '<div style="text-align:right"><button class="btn btn-p" data-act="savePks">' + mi('save') + ' Simpan PKS</button></div>'
      : (k ? '<dl class="kv"><dt>Para pihak</dt><dd>' + esc(k.para_pihak || '-') + '</dd><dt>Ruang lingkup</dt><dd>' + esc(k.ruang_lingkup || '-') + '</dd><dt>Masa berlaku</dt><dd>' + esc(k.masa_berlaku || '-') + '</dd><dt>Lapor Gubernur</dt><dd>' + (k.tgl_lapor_gubernur ? fmtD(k.tgl_lapor_gubernur) + ' · ' + esc(k.bukti_lapor || '') : '-') + '</dd></dl>' : '<span class="t-sub">-</span>')) + '</div>';
  return baBox('Pemaparan', [6, 7]) + baBox('Hasil Penelaahan', [7, 8]) + pks;
}
function tMonev(p, d) {
  const can = p.tahap === 12 && p.status !== 'Selesai' && ['mitra', 'prl', 'uptd', 'admin'].indexOf(S.me.peran) > -1;
  const list = d.monev.map(function (m) { return '<div class="it" style="padding:10px 0;border-bottom:1px solid var(--line)"><b>' + esc(m.periode) + '</b> <span class="chip c-teal">' + esc(m.capaian_persen) + '%</span><div class="t-sub">' + esc(m.pelapor) + ' · ' + fmtD(m.dibuat) + '</div><div>' + esc(m.kendala || '') + '</div>' + (m.rekomendasi ? '<div class="t-sub">Rekomendasi: ' + esc(m.rekomendasi) + '</div>' : '') + '</div>'; }).join('') || '<div class="empty" style="padding:18px">Belum ada laporan.</div>';
  return '<div class="grid g-main"><div class="card"><h3>Laporan monitoring (Lampiran VIII)</h3><p class="sub">Terbaru di atas.</p>' + list + '</div>' + (can ? '<div class="card"><h3>Tambah laporan</h3><div class="fld"><label>Periode <i>*</i></label><input class="in" id="mvP" placeholder="mis. Triwulan I 2027"></div><div class="fld"><label>Target</label><input class="in" id="mvT"></div><div class="row2"><div class="fld"><label>Capaian (%)</label><input type="number" min="0" max="100" class="in" id="mvC"></div><div class="fld"><label>Realisasi biaya</label><input class="in" id="mvR"></div></div><div class="fld"><label>Kendala</label><textarea class="in" id="mvK"></textarea></div><div class="fld"><label>Rekomendasi</label><textarea class="in" id="mvRek"></textarea></div><button class="btn btn-p btn-block" data-act="saveMv">' + mi('add') + ' Kirim laporan</button></div>' : '') + '</div>';
}
function tRiwayat(p, d) {
  return '<div class="card"><h3>Jejak audit</h3><p class="sub">Setiap keputusan dicatat permanen.</p><div class="tl">' + (d.riwayat.map(function (r) { return '<div class="it ' + (/Tidak/.test(r.keputusan) ? 'bad' : '') + '"><b>' + esc(r.keputusan) + '</b> <span class="t-sub">(tahap ' + esc(r.dari) + ' → ' + esc(r.ke) + ')</span><small>' + esc(r.pelaku) + ' · ' + esc(PERAN_L(r.peran)) + ' · ' + fmtDT(r.waktu) + '</small>' + (r.catatan ? '<div class="note">' + esc(r.catatan) + '</div>' : '') + '</div>'; }).join('') || '<div class="empty">Belum ada riwayat.</div>') + '</div></div>';
}
function PERAN_L(r) { return { mitra: 'Mitra', prl: 'PRL', uptd: 'UPTD', kepala_dkp: 'Kepala DKP', admin: 'Admin' }[r] || r; }
