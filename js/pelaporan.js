/* =====================================================================
 * Pelaporan (v3.7): dua jenis laporan yang terbit sebagai majalah publik
 *   - Laporan Hasil Program (ditulis mitra, terbit setelah disetujui Admin UPTD)
 *   - Laporan Hasil Evaluasi (ditulis Admin UPTD)
 *   + tab Berkas Monev (PDF)
 * ===================================================================== */
'use strict';
const LAP_J = { program: { nama: 'Laporan Hasil Program', oleh: 'dari mitra', ic: 'campaign' }, evaluasi: { nama: 'Laporan Hasil Evaluasi', oleh: 'dari UPTD', ic: 'fact_check' } };
S.lap = S.lap || null; S.pelTab = S.pelTab || 'program';

function lapBisaBuat(j) { return j === 'program' ? can(['mitra']) : can(['admin', 'uptd']); }
function lapBisaEdit(r) { if (isSuper()) return true; if (r.status !== 'Draf') return false; return r.jenis === 'program' ? S.me.peran === 'mitra' : can(['admin', 'uptd']); }
function lapStatusChip(s) { return '<span class="chip ' + (s === 'Terbit' ? 'c-ok' : s === 'Diajukan' ? 'c-warn' : 'c-draft') + '">' + esc(s) + '</span>'; }

function pelMonevHtml() {
  const all = pelaporanRows(); const q = (S.pelQ || '').toLowerCase().trim();
  const a = all.filter(function (x) { return !q || (x.p.nomor + ' ' + x.p.judul + ' ' + x.p.lembaga + ' ' + x.p.kawasan + ' ' + x.m.periode).toLowerCase().indexOf(q) > -1; });
  const avg = all.length ? all.reduce(function (s, x) { return s + Number(x.m.capaian_persen || 0); }, 0) / all.length : null;
  const adaPdf = all.filter(function (x) { return x.m.file; }).length;
  const rows = a.map(function (x) {
    return '<tr data-act="bukaMonev" data-id="' + esc(x.p.id) + '"><td class="t-b">' + esc(x.m.periode) + '</td><td><b>' + esc(x.p.judul) + '</b><div class="t-sub">' + esc(x.p.nomor) + ' · ' + esc(x.p.lembaga) + '</div></td><td>' + esc(x.p.kawasan) + '</td><td><span class="chip c-teal">' + esc(x.m.capaian_persen) + '%</span></td><td>' + esc(x.m.pelapor) + '<div class="t-sub">' + fmtD(x.m.dibuat) + '</div></td><td data-stop="1">' + (x.m.file ? fileChip(x.m.file, false) : '<span class="t-sub">Tanpa PDF</span>') + '</td></tr>';
  }).join('');
  return ('<div class="ph" style="margin-bottom:10px"><div><h3 style="margin:0">Berkas laporan monev (PDF)</h3><p class="sub">Laporan monitoring & evaluasi tahap 12 beserta berkas PDF yang diunggah.</p></div><div class="sp"></div><button class="btn btn-o" data-act="exportMonev">' + mi('download') + ' Ekspor (CSV)</button></div>' +
    '<div class="kpis"><div class="kpi2"><div class="lb"><span>Total laporan</span></div><div class="vl">' + all.length + '</div></div><div class="kpi2"><div class="lb"><span>Rata-rata capaian</span></div><div class="vl">' + (avg === null ? '–' : numID(avg, 1) + '%') + '</div></div><div class="kpi2"><div class="lb"><span>Dengan berkas PDF</span></div><div class="vl">' + adaPdf + '</div></div></div>' +
    '<div class="card" style="margin:14px 0;padding:14px"><input id="pelQ" class="in" type="search" placeholder="Cari program, mitra, kawasan, periode…" aria-label="Cari" value="' + esc(S.pelQ || '') + '"></div>' +
    '<div class="card">' + (a.length ? '<div class="tbl-wrap"><table><thead><tr><th>Periode</th><th>Program / Mitra</th><th>Kawasan</th><th>Capaian</th><th>Pelapor</th><th>Berkas</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty" style="padding:24px">' + (all.length ? 'Tidak ada laporan yang cocok.' : 'Belum ada laporan monev. Laporan diisi pada tahap 12 (pelaksanaan) oleh Admin UPTD atau mitra.') + '</div>') + '</div>');
}
function pelMonevBind() {
  const qi = $('pelQ'); if (qi) qi.addEventListener('input', debounce(function () { S.pelQ = this.value; const pos = this.selectionStart; vPelaporan(); const n = $('pelQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 150));
}
function lapCardHtml(r) {
  const own = lapBisaEdit(r), staf = can(['admin', 'uptd']);
  const b = [];
  b.push('<button class="btn btn-o btn-s" data-act="lapBaca" data-id="' + esc(r.id) + '">' + mi('auto_stories') + ' Baca</button>');
  const mitraPemilik = r.jenis === 'program' && can(['mitra']);
  if (own) b.push('<button class="btn btn-p btn-s" data-act="lapEdit" data-id="' + esc(r.id) + '">' + mi('edit') + ' ' + (r.status === 'Draf' ? 'Edit laporan' : 'Sunting (Super Admin)') + '</button>');
  else if (mitraPemilik && r.status !== 'Draf') b.push('<button class="btn btn-p btn-s" data-act="lapRevisi" data-s="' + esc(r.status) + '" data-id="' + esc(r.id) + '">' + mi('edit') + ' Edit laporan</button>');
  if (r.jenis === 'program' && r.status === 'Draf' && can(['mitra'])) b.push('<button class="btn btn-o btn-s" data-act="lapAksi" data-a="ajukan" data-id="' + esc(r.id) + '">' + mi('send') + ' Ajukan terbit</button>');
  if (staf && ((r.jenis === 'program' && r.status === 'Diajukan') || (r.jenis === 'evaluasi' && r.status === 'Draf') || (isSuper() && r.status === 'Draf'))) b.push('<button class="btn btn-p btn-s" data-act="lapAksi" data-a="terbit" data-j="' + r.jenis + '" data-id="' + esc(r.id) + '">' + mi('publish') + (r.jenis === 'evaluasi' ? ' Finalkan' : ' Terbitkan') + '</button>');
  if (staf && r.status !== 'Draf') b.push('<button class="btn btn-o btn-s" data-act="lapAksi" data-a="tarik" data-id="' + esc(r.id) + '">' + mi('undo') + ' ' + (r.status === 'Terbit' ? 'Tarik dari publik' : 'Kembalikan ke draf') + '</button>');
  if (r.status === 'Terbit') b.push('<button class="btn btn-o btn-s" data-act="lapTautan" data-id="' + esc(r.id) + '">' + mi('link') + ' Salin tautan</button>');
  if (own) b.push('<button class="btn btn-o btn-s" data-act="lapHapus" data-id="' + esc(r.id) + '" style="color:var(--coral)">' + mi('delete') + '</button>');
  return '<div class="card lap-card"><div class="lap-top">' + lapStatusChip(r.status) + (r.status === 'Terbit' ? '<span class="chip c-teal">Edisi ' + esc(String(r.edisi).padStart(2, '0')) + '</span>' : '') + '</div><h3>' + esc(r.judul) + '</h3><p class="t-sub">' + esc(r.jenis === 'evaluasi' ? 'Evaluasi · ' + (r.wilayah_nama || 'UPTD') : r.lembaga) + ' · ' + esc(r.kawasan) + (r.periode ? ' · ' + esc(r.periode) : '') + '</p><p class="t-sub">Diperbarui ' + fmtD(r.diubah) + (r.capaian_persen !== '' ? ' · Capaian ' + esc(r.capaian_persen) + '%' : '') + '</p><div class="lap-act">' + b.join('') + '</div></div>';
}
function vPelaporan() {
  setTitle('Pelaporan Mitra'); const tab = S.pelTab;
  const tabs = ['program', 'evaluasi', 'monev'].map(function (k) { return '<button class="mg-tab' + (tab === k ? ' on' : '') + '" data-act="pelTab" data-k="' + k + '">' + (k === 'monev' ? 'Berkas Monev (PDF)' : LAP_J[k].nama.replace('Laporan ', '') + ' ' + LAP_J[k].oleh) + '</button>'; }).join('');
  let inner;
  if (tab === 'monev') inner = pelMonevHtml();
  else {
    const J = LAP_J[tab]; const L = (S.lap || []).filter(function (r) { return r.jenis === tab; });
    const info = tab === 'program' ? 'Mitra menulis laporan hasil program (foto, capaian, kendala) lalu mengajukannya. Setelah disetujui Admin UPTD, laporan terbit sebagai majalah yang dapat dibaca siapa saja.' : 'Admin UPTD menulis hasil evaluasi kegiatan mitra. Laporan ini bersifat internal dan tidak ditampilkan di majalah publik; setelah difinalkan, mitra pemilik usulan dapat membacanya.';
    inner = '<div class="ph" style="margin-bottom:10px"><div><h3 style="margin:0">' + J.nama + '</h3><p class="sub">' + info + '</p></div><div class="sp"></div>' + (lapBisaBuat(tab) || isSuper() ? '<button class="btn btn-p" data-act="lapBaru" data-j="' + tab + '">' + mi('add') + ' Buat laporan</button>' : '') + '<button class="btn btn-o" data-act="bukaMajalah">' + mi('public') + ' Galeri publik</button></div>' +
      (S.lap === null ? '<div class="card"><div class="empty" style="padding:24px">Memuat laporan…</div></div>' : L.length ? '<div class="lap-grid">' + L.map(lapCardHtml).join('') + '</div>' : '<div class="card"><div class="empty" style="padding:28px">Belum ada ' + J.nama.toLowerCase() + '.' + (lapBisaBuat(tab) ? ' Klik <b>Buat laporan</b> untuk memulai (usulan harus berada di tahap 12).' : '') + '</div></div>');
  }
  setView('<div class="ph"><div><h2>Pelaporan Mitra</h2><p>Laporan hasil program mitra (terbit sebagai majalah), hasil evaluasi UPTD (internal), dan berkas monev.</p></div></div><div class="tabs mg-tabs">' + tabs + '</div>' + inner);
  if (tab === 'monev') pelMonevBind();
  if (S.lap === null || !S._lapFresh) { S._lapFresh = true; api('laporan_daftar').then(function (L) { const sama = JSON.stringify(L) === JSON.stringify(S.lap); S.lap = L; if (!sama && S.view === 'pelaporan') vPelaporan(); }).catch(function (e) { if (S.lap === null) S.lap = []; toast('bad', e.message); if (S.view === 'pelaporan') vPelaporan(); }); }
}
/* ----------------------------- kartu dashboard ----------------------------- */
function pelaporanCard() {
  return '<div class="card" style="margin-bottom:16px"><div class="card-h"><div class="ic">' + mi('auto_stories') + '</div><div><h3>Majalah Pelaporan Mitra</h3><p class="sub">Laporan hasil program mitra yang sudah terbit</p></div><div class="sp"></div><button class="btn btn-o btn-s" data-act="bukaMajalah">Galeri publik</button><button class="btn btn-p btn-s" data-act="goPelaporan">Kelola pelaporan</button></div><div id="dashMag" class="dash-mag"><div class="empty" style="padding:16px">Memuat majalah…</div></div></div>';
}
function dashMagFill() {
  const el = $('dashMag'); if (!el) return;
  const draw = function () { const e2 = $('dashMag'); if (!e2) return; const L = (MAG.daftar || []).slice(0, 6); e2.innerHTML = L.length ? '<div class="dm-row">' + L.map(function (r) { return magCard(r).replace('href="#/majalah/' + esc(r.id) + '"', 'href="#/majalah/' + esc(r.id) + '" data-act="bacaMajalah" data-id="' + esc(r.id) + '"'); }).join('') + '</div>' : '<div class="empty" style="padding:16px">Belum ada majalah yang diterbitkan.</div>'; magLoadPhotos(e2, false); };
  if (MAG.daftar) draw();
  api('majalah_daftar').then(function (L) { MAG.daftar = L; draw(); }).catch(function () { if (!MAG.daftar) { MAG.daftar = []; draw(); } });
}

/* ----------------------------- editor laporan ----------------------------- */
function imgCompress(file) {
  return new Promise(function (res, rej) {
    if (!/^image\//.test(file.type)) { rej(new Error('Berkas "' + file.name + '" bukan gambar.')); return; }
    const fr = new FileReader(); fr.onerror = function () { rej(new Error('Foto tidak dapat dibaca.')); };
    fr.onload = function () {
      const im = new Image(); im.onerror = function () { rej(new Error('Foto "' + file.name + '" tidak dapat dibuka.')); };
      im.onload = function () {
        const tries = [[1600, .82], [1280, .75], [1024, .7], [800, .65]];
        for (let i = 0; i < tries.length; i++) {
          const k = Math.min(1, tries[i][0] / Math.max(im.width, im.height)); const w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k));
          const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
          const b64 = c.toDataURL('image/jpeg', tries[i][1]).split(',')[1]; if (b64.length * 0.75 <= 1.4 * 1024 * 1024) { res(b64); return; }
        }
        rej(new Error('Foto "' + file.name + '" terlalu besar.'));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function lapLabel(j) {
  return j === 'evaluasi'
    ? { ringkasan: 'Ringkasan evaluasi', keg: 'Temuan evaluasi', kegAdd: 'Tambah temuan', dampak: null, kendala: 'Permasalahan', rek: 'Rekomendasi tindak lanjut', kes: 'Kesimpulan penilaian' }
    : { ringkasan: 'Ringkasan kegiatan', keg: 'Sorotan kegiatan', kegAdd: 'Tambah sorotan', dampak: 'Dampak & manfaat', kendala: 'Kendala di lapangan', rek: 'Rencana & rekomendasi', kes: 'Penutup' };
}
function vLaporanEdit() {
  setTitle('Editor Laporan'); const id = S.params.id;
  if (!S.lapEd || S.lapEd.d.id !== id) { S.lapEd = null; setView('<div class="card"><div class="empty" style="padding:30px">Memuat laporan…</div></div>'); api('laporan_baca', { id: id }).then(function (d) { S.lapEd = { d: d }; if (S.view === 'laporanEdit') lapEdRender(); }).catch(function (e) { toast('bad', e.message); navigateTo('pelaporan'); }); return; }
  lapEdRender();
}
function lapEdRender() {
  const E = S.lapEd, d = E.d, isi = d.isi || {}, L = lapLabel(d.jenis), ro = !d.boleh_edit, dis = ro ? ' disabled' : '';
  const foto = d.foto || [];
  const fotoOpt = function (sel) { return '<option value="">— tanpa foto —</option>' + foto.map(function (f) { return '<option value="' + esc(f.id) + '"' + (sel === f.id ? ' selected' : '') + '>' + esc(f.nama) + '</option>'; }).join(''); };
  const keg = (isi.kegiatan && isi.kegiatan.length ? isi.kegiatan : []).map(function (k, i) {
    return '<div class="lp-keg" data-i="' + i + '"><div class="lp-kh"><b>' + L.keg + ' ' + (i + 1) + '</b>' + (ro ? '' : '<button type="button" class="btn btn-o btn-s" data-act="lapKegDel" data-i="' + i + '" aria-label="Hapus">' + mi('delete') + '</button>') + '</div><div class="fld"><label>Judul</label><input class="in" data-k="judul" maxlength="100" value="' + esc(k.judul) + '"' + dis + '></div><div class="fld"><label>Sorotan <span class="t-sub">(1 kalimat untuk teks berjalan di majalah; boleh dikosongkan)</span></label><input class="in" data-k="sorotan" maxlength="140" placeholder="mis. 1.200 fragmen karang berhasil ditransplantasi" value="' + esc(k.sorotan || '') + '"' + dis + '></div><div class="fld"><label>Uraian</label><textarea class="in" data-k="teks" rows="3" maxlength="1200"' + dis + '>' + esc(k.teks) + '</textarea></div><div class="fld"><label>Foto</label><select class="in" data-k="foto"' + dis + '>' + fotoOpt(k.foto) + '</select></div></div>';
  }).join('');
  const gset = {}; (isi.galeri || []).forEach(function (g) { gset[g.id] = g.ket; });
  const gal = foto.map(function (f) { const on = gset[f.id] !== undefined; return '<label class="lp-g"><input type="checkbox" data-g="' + esc(f.id) + '"' + (on ? ' checked' : '') + dis + '><div class="lp-th" data-foto="' + esc(f.id) + '"></div><input class="in" data-gk="' + esc(f.id) + '" placeholder="Keterangan foto" maxlength="120" value="' + esc(gset[f.id] || '') + '"' + dis + '></label>'; }).join('');
  const ta = function (idv, lab, val, mx, rows) { return '<div class="fld"><label>' + lab + '</label><textarea class="in" id="' + idv + '" rows="' + (rows || 4) + '" maxlength="' + mx + '"' + dis + '>' + esc(val || '') + '</textarea></div>'; };
  setView('<div class="ph"><div><h2>' + esc(LAP_J[d.jenis].nama) + '</h2><p>' + esc(d.kawasan) + ' · ' + esc(d.lembaga) + ' · ' + lapStatusChip(d.status) + '</p></div><div class="sp"></div><button class="btn btn-o" data-act="lapKembali">' + mi('arrow_back') + ' Kembali</button></div>' +
    (ro ? '<div class="callout info" style="margin-bottom:14px">' + mi('lock') + ' Laporan berstatus <b>' + esc(d.status) + '</b> dan tidak dapat disunting. ' + (d.status !== 'Draf' ? 'Minta Admin UPTD mengembalikannya ke draf bila perlu diubah.' : '') + '</div>' : '') +
    '<div class="card"><h3>Identitas majalah</h3><div class="grid2"><div class="fld"><label>Judul <i>*</i></label><input class="in" id="lpJ" maxlength="120" value="' + esc(d.judul) + '"' + dis + '></div><div class="fld"><label>Periode</label><input class="in" id="lpP" maxlength="40" placeholder="mis. Triwulan I 2026" value="' + esc(d.periode) + '"' + dis + '></div></div><div class="fld" style="max-width:240px"><label>Capaian (%)' + (d.jenis === 'evaluasi' ? ' — dipakai untuk penilaian' : '') + '</label><input class="in" id="lpC" type="number" min="0" max="100" step="0.1" value="' + esc(d.capaian_persen) + '"' + dis + '></div>' + ta('lpR', L.ringkasan + ' <i>*</i>', isi.ringkasan, 2000, 6) + '</div>' +
    '<div class="card"><div class="card-h"><div><h3>Foto</h3><p class="sub">Maks. 10 foto (JPG/PNG, otomatis dikecilkan). Pilih foto sampul, lalu tempatkan foto pada ' + L.keg.toLowerCase() + ' atau galeri.</p></div><div class="sp"></div>' + (ro ? '' : '<label class="btn btn-p btn-s" style="cursor:pointer">' + mi('add_photo_alternate') + ' Tambah foto<input type="file" id="lpF" accept="image/*" multiple hidden></label>') + '</div>' +
    (foto.length ? '<div class="fld" style="max-width:340px"><label>Foto sampul</label><select class="in" id="lpS"' + dis + '>' + fotoOpt(isi.sampul) + '</select></div><div class="lp-gal">' + foto.map(function (f) { return '<div class="lp-f"><div class="lp-th" data-foto="' + esc(f.id) + '"></div><small>' + esc(f.nama) + '</small>' + (ro ? '' : '<button type="button" class="btn btn-o btn-s" data-act="lapFotoDel" data-id="' + esc(f.id) + '">' + mi('delete') + ' Hapus</button>') + '</div>'; }).join('') + '</div>' : '<div class="empty" style="padding:14px">Belum ada foto.</div>') + '</div>' +
    '<div class="card"><div class="card-h"><div><h3>' + L.keg + '</h3><p class="sub">Maks. 8 bagian; tiap bagian menjadi satu halaman majalah.</p></div><div class="sp"></div>' + (ro || (isi.kegiatan || []).length >= 8 ? '' : '<button class="btn btn-o btn-s" data-act="lapKegAdd">' + mi('add') + ' ' + L.kegAdd + '</button>') + '</div><div id="lpKeg">' + (keg || '<div class="empty" style="padding:14px">Belum ada bagian.</div>') + '</div></div>' +
    (foto.length ? '<div class="card"><h3>Galeri foto</h3><p class="sub">Centang foto yang ingin ditampilkan pada halaman galeri.</p><div class="lp-galsel">' + gal + '</div></div>' : '') +
    '<div class="card"><h3>Catatan penutup</h3>' + (L.dampak ? ta('lpD', L.dampak, isi.dampak, 1500) : '') + ta('lpK', L.kendala, isi.kendala, 1500) + ta('lpRek', L.rek, isi.rekomendasi, 1500) + ta('lpKes', L.kes, isi.kesimpulan, 1500) + '</div>' +
    '<div class="lp-bar">' + (ro ? '' : '<button class="btn btn-o" data-act="lapSimpan">' + mi('save') + ' Simpan draf</button>') + '<button class="btn btn-o" data-act="lapPratinjau">' + mi('visibility') + ' Pratinjau majalah</button><div class="sp"></div>' + (!ro && d.jenis === 'program' && can(['mitra']) ? '<button class="btn btn-p" data-act="lapSimpanAksi" data-a="ajukan">' + mi('send') + ' Simpan &amp; ajukan terbit</button>' : '') + (!ro && d.jenis === 'evaluasi' ? '<button class="btn btn-p" data-act="lapSimpanAksi" data-a="terbit">' + mi('publish') + ' Simpan &amp; finalkan</button>' : '') + '</div>');
  magLoadPhotos($('view'), true);
}
function lapEdCollect() {
  const E = S.lapEd; if (!E || !$('lpJ')) return; const d = E.d, isi = d.isi = d.isi || {}; const v = function (i) { const e = $(i); return e ? e.value : undefined; };
  if (d.boleh_edit === false) return;
  d.judul = v('lpJ'); d.periode = v('lpP'); d.capaian_persen = v('lpC'); isi.ringkasan = v('lpR');
  ['lpD', 'dampak', 'lpK', 'kendala', 'lpRek', 'rekomendasi', 'lpKes', 'kesimpulan'].forEach(function (x, i, a) { if (i % 2 === 0 && $(x)) isi[a[i + 1]] = $(x).value; });
  isi.sampul = v('lpS') || '';
  isi.kegiatan = Array.prototype.map.call(document.querySelectorAll('#lpKeg .lp-keg'), function (el) { const g = function (k) { return el.querySelector('[data-k="' + k + '"]').value; }; return { judul: g('judul'), sorotan: g('sorotan'), teks: g('teks'), foto: g('foto') }; });
  isi.galeri = Array.prototype.filter.call(document.querySelectorAll('.lp-galsel [data-g]'), function (c) { return c.checked; }).map(function (c) { const k = document.querySelector('[data-gk="' + c.dataset.g + '"]'); return { id: c.dataset.g, ket: k ? k.value : '' }; });
}
function lapEdPayload() { const d = S.lapEd.d; return { id: d.id, judul: d.judul, periode: d.periode, capaian_persen: d.capaian_persen, isi: d.isi }; }
function lapEdSave(btn) {
  lapEdCollect(); if (!S.lapEd.d.judul || !S.lapEd.d.judul.trim()) { toast('bad', 'Judul laporan wajib diisi.'); return Promise.reject(new Error('judul')); }
  loadingBtn(btn, true);
  return api('laporan_simpan', lapEdPayload()).then(function (r) { S.lapEd.d = r; S.lap = null; S._lapFresh = false; loadingBtn(btn, false); return r; }).catch(function (e) { loadingBtn(btn, false); toast('bad', e.message); throw e; });
}
Object.assign(ACT, {
  pelTab: function (el) { S.pelTab = el.dataset.k; vPelaporan(); },
  lapBaru: function (el) {
    const j = el.dataset.j; const el12 = S.daftar.filter(function (p) { return p.tahap === 12; });
    if (!el12.length) { modal({ title: 'Belum ada usulan tahap 12', body: '<p>Laporan dibuat untuk usulan yang sudah berada pada <b>tahap 12 (pelaksanaan)</b>.</p>', ok: 'Mengerti', hideCancel: true }); return; }
    modal({ title: 'Buat ' + LAP_J[j].nama, body: '<div class="fld"><label>Usulan / program <i>*</i></label><select class="in" id="lbP">' + el12.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nomor + ' — ' + p.judul + ' (' + p.lembaga + ')') + '</option>'; }).join('') + '</select></div><div class="fld"><label>Judul majalah <i>*</i></label><input class="in" id="lbJ" maxlength="120" placeholder="mis. Menjaga Terumbu Karang Teluk Tomini"></div><div class="fld"><label>Periode</label><input class="in" id="lbT" maxlength="40" placeholder="mis. Triwulan I 2026"></div>', ok: 'Buat & isi',
      onOk: function () { const jd = $('lbJ').value.trim(); if (!jd) { $('mErr').textContent = 'Judul wajib diisi.'; return false; } return api('laporan_simpan', { jenis: j, id_pengajuan: $('lbP').value, judul: jd, periode: $('lbT').value }).then(function (r) { S.lapEd = { d: r }; S.lap = null; S._lapFresh = false; closeModal(); navigateTo('laporanEdit', { id: r.id }); }); } });
  },
  lapRevisi: function (el) {
    const terbit = el.dataset.s === 'Terbit', id = el.dataset.id;
    modal({ title: 'Edit laporan?', body: '<p>' + (terbit ? 'Laporan ini sedang <b>terbit di majalah</b>. Agar bisa diedit, laporan akan <b>ditarik dari majalah publik</b> dan kembali menjadi Draf.' : 'Laporan ini sedang menunggu persetujuan Admin UPTD. Agar bisa diedit, laporan akan kembali menjadi Draf.') + '</p><p class="t-sub">Setelah selesai mengedit, tekan <b>Ajukan terbit</b> lagi. ' + (terbit ? 'Nomor edisi tetap sama.' : '') + '</p>', ok: 'Ya, edit laporan', onOk: function () { return api('laporan_aksi', { id: id, aksi: 'revisi' }).then(function () { S.lap = null; S._lapFresh = false; MAG.daftar = null; S.lapEd = null; navigateTo('laporanEdit', { id: id }); }); } });
  },
  lapEdit: function (el) { S.lapEd = null; navigateTo('laporanEdit', { id: el.dataset.id }); },
  lapKembali: function () { S.lapEd = null; navigateTo('pelaporan'); },
  lapBaca: function (el) { api('laporan_baca', { id: el.dataset.id }).then(function (d) { magOpenReader(d, { preview: d.status !== 'Terbit' }); }).catch(function (e) { toast('bad', e.message); }); },
  bacaMajalah: function (el, ev) { if (ev) ev.preventDefault(); MAG.fromApp = true; location.hash = '#/majalah/' + el.dataset.id; },
  lapTautan: function (el) { const u = magLink(el.dataset.id); (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('ok', 'Tautan majalah disalin.'); }).catch(function () { window.prompt('Salin tautan majalah:', u); }); },
  lapAksi: function (el) {
    const a = el.dataset.a, ev = el.dataset.j === 'evaluasi'; let tx = { ajukan: ['Ajukan terbit?', 'Laporan dikirim ke Admin UPTD untuk ditinjau. Setelah diajukan, laporan tidak dapat diubah.', 'Ajukan'], terbit: ['Terbitkan majalah?', 'Laporan akan dapat dibaca siapa saja tanpa login.', 'Terbitkan'], tarik: ['Tarik laporan?', 'Laporan kembali ke status Draf dan tidak lagi tampil di publik.', 'Tarik'] }[a];
    if (a === 'terbit' && ev) tx = ['Finalkan evaluasi?', 'Laporan evaluasi bersifat internal: tidak tampil di majalah publik, dan setelah final dapat dibaca mitra pemilik usulan.', 'Finalkan'];
    modal({ title: tx[0], body: '<p>' + tx[1] + '</p>', ok: tx[2], onOk: function () { return api('laporan_aksi', { id: el.dataset.id, aksi: a }).then(function () { S.lap = null; S._lapFresh = false; MAG.daftar = null; closeModal(); toast('ok', a === 'ajukan' ? 'Laporan diajukan.' : a === 'terbit' ? (ev ? 'Evaluasi difinalkan.' : 'Majalah terbit.') : 'Laporan ditarik.'); if (S.view === 'pelaporan') vPelaporan(); }); } });
  },
  lapHapus: function (el) { modal({ title: 'Hapus laporan?', body: '<p>Laporan beserta foto-fotonya dihapus permanen.</p>', ok: 'Hapus', danger: true, onOk: function () { return api('laporan_hapus', { id: el.dataset.id }).then(function () { S.lap = null; S._lapFresh = false; MAG.daftar = null; closeModal(); toast('ok', 'Laporan dihapus.'); if (S.view === 'laporanEdit') { S.lapEd = null; navigateTo('pelaporan'); } else vPelaporan(); }); } }); },
  lapKegAdd: function () { lapEdCollect(); const i = S.lapEd.d.isi; i.kegiatan = (i.kegiatan || []).concat([{ judul: '', sorotan: '', teks: '', foto: '' }]); lapEdRender(); },
  lapKegDel: function (el) { lapEdCollect(); const i = S.lapEd.d.isi; i.kegiatan.splice(+el.dataset.i, 1); lapEdRender(); },
  lapSimpan: function (el) { lapEdSave(el).then(function () { toast('ok', 'Draf tersimpan.'); lapEdRender(); }).catch(function () {}); },
  lapPratinjau: function (el) { const go = function () { magOpenReader(S.lapEd.d, { preview: true }); }; if (S.lapEd.d.boleh_edit) lapEdSave(el).then(function () { lapEdRender(); go(); }).catch(function () {}); else go(); },
  lapSimpanAksi: function (el) { const a = el.dataset.a; lapEdSave(el).then(function (r) { return api('laporan_aksi', { id: r.id, aksi: a }); }).then(function () { S.lap = null; S._lapFresh = false; MAG.daftar = null; toast('ok', a === 'ajukan' ? 'Laporan diajukan ke Admin UPTD.' : 'Evaluasi difinalkan.'); S.lapEd = null; navigateTo('pelaporan'); }).catch(function (e) { if (e && e.message !== 'judul') toast('bad', e.message); }); },
  lapFotoDel: function (el) { lapEdCollect(); loadingBtn(el, true); api('laporan_foto_hapus', { id_berkas: el.dataset.id }).then(function () { const d = S.lapEd.d; d.foto = d.foto.filter(function (f) { return f.id !== el.dataset.id; }); const i = d.isi; if (i.sampul === el.dataset.id) i.sampul = ''; (i.kegiatan || []).forEach(function (k) { if (k.foto === el.dataset.id) k.foto = ''; }); i.galeri = (i.galeri || []).filter(function (g) { return g.id !== el.dataset.id; }); lapEdRender(); }).catch(function (e) { loadingBtn(el, false); toast('bad', e.message); }); }
});
document.addEventListener('change', function (e) {
  const t = e.target; if (!t || t.id !== 'lpF' || !S.lapEd) return;
  const files = Array.prototype.slice.call(t.files || []); t.value = ''; if (!files.length) return; lapEdCollect();
  const d = S.lapEd.d; let ok = 0; const next = function (i) {
    if (i >= files.length) { lapEdRender(); if (ok) toast('ok', ok + ' foto diunggah.'); return; }
    if ((d.foto || []).length >= 10) { toast('bad', 'Maksimal 10 foto per laporan.'); lapEdRender(); return; }
    toast('ok', 'Mengunggah foto ' + (i + 1) + ' dari ' + files.length + '…');
    imgCompress(files[i]).then(function (b64) { return api('laporan_foto_unggah', { id: d.id, nama: files[i].name.replace(/\.[^.]+$/, '') + '.jpg', base64: b64 }); }).then(function (f) { d.foto = (d.foto || []).concat([f]); ok++; next(i + 1); }).catch(function (er) { toast('bad', er.message); next(i + 1); });
  }; next(0);
});
