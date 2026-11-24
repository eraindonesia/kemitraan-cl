/* =====================================================================
 * Majalah digital — pembaca laporan (publik tanpa login) + galeri.
 *  - Galeri:  #/majalah          - Pembaca: #/majalah/<id>
 *  - Dua jenis: 'program' (hasil program mitra) dan 'evaluasi' (hasil evaluasi UPTD)
 *  - Foto dimuat malas (lazy) lewat majalah_foto (publik) atau laporan_foto (pratinjau, perlu login)
 * ===================================================================== */
'use strict';
const MAG = { fotos: {}, data: null, pages: [], spreads: [], cur: 0, preview: false, daftar: null, filter: 'semua', wide: false };
const MAG_JENIS = { program: { nama: 'Laporan Hasil Program', oleh: 'Mitra', warna: 'program' }, evaluasi: { nama: 'Laporan Hasil Evaluasi', oleh: 'UPTD', warna: 'evaluasi' } };

function magEl() { let e = document.getElementById('pubMag'); if (!e) { e = document.createElement('div'); e.id = 'pubMag'; e.hidden = true; document.body.appendChild(e); } return e; }
function magFotoUrl(id, preview) {
  if (!id) return Promise.reject(new Error('x'));
  if (MAG.fotos[id]) return MAG.fotos[id];
  MAG.fotos[id] = api(preview ? 'laporan_foto' : 'majalah_foto', { id_berkas: id }).then(function (r) { return 'data:' + r.mime + ';base64,' + r.base64; }).catch(function (e) { delete MAG.fotos[id]; throw e; });
  return MAG.fotos[id];
}
function magLoadPhotos(root, preview) {
  Array.prototype.forEach.call(root.querySelectorAll('[data-foto]:not(.ok):not(.err)'), function (el) {
    magFotoUrl(el.dataset.foto, preview).then(function (u) { el.style.backgroundImage = 'url("' + u + '")'; el.classList.add('ok'); }).catch(function () { el.classList.add('err'); });
  });
}
function magPara(t) { const s = String(t || '').trim(); if (!s) return ''; return s.split(/\n{1,}/).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join(''); }
function magNilai(c) { c = Number(c); if (isNaN(c)) return ''; return c >= 85 ? 'Sangat Baik' : c >= 70 ? 'Baik' : c >= 55 ? 'Cukup' : 'Perlu Perbaikan'; }
function magGauge(pct) {
  const c = 2 * Math.PI * 54, v = Math.max(0, Math.min(100, Number(pct) || 0));
  return '<svg viewBox="0 0 140 140" class="mg-gauge" role="img" aria-label="Capaian ' + Math.round(v) + ' persen"><circle cx="70" cy="70" r="54" class="bg"/><circle cx="70" cy="70" r="54" class="fg" stroke-dasharray="' + (c * v / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 70 70)"/><text x="70" y="80" text-anchor="middle">' + Math.round(v) + '%</text></svg>';
}
function magWaves() { return '<svg class="mg-waves" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 Q50 10 100 40 T200 40 T300 40 T400 40 V120 H0Z" opacity=".18"/><path d="M0 62 Q50 32 100 62 T200 62 T300 62 T400 62 V120 H0Z" opacity=".22"/><path d="M0 84 Q50 54 100 84 T200 84 T300 84 T400 84 V120 H0Z" opacity=".3"/></svg>'; }
function magFig(id, ket, cls) { return '<figure class="mg-ph ' + (cls || '') + '"><div class="img" data-foto="' + esc(id) + '"></div>' + (ket ? '<figcaption>' + esc(ket) + '</figcaption>' : '') + '</figure>'; }

/** Menyusun halaman majalah dari data laporan. */
function magBuild(m) {
  const isi = m.isi || {}, ev = m.jenis === 'evaluasi', J = MAG_JENIS[m.jenis] || MAG_JENIS.program, pages = [];
  const sampul = isi.sampul || ((isi.kegiatan || []).filter(function (k) { return k.foto; })[0] || {}).foto || ((isi.galeri || [])[0] || {}).id || '';
  const tgl = m.terbit ? fmtD(m.terbit) : 'Pratinjau';
  pages.push({ k: 'cover', html: '<div class="mg-cover">' + (sampul ? '<div class="mg-bgimg" data-foto="' + esc(sampul) + '"></div>' : magWaves()) + '<div class="mg-shade"></div><div class="mg-in"><div class="mg-mast"><b>SI-MITRA</b><span>' + esc(J.nama) + '</span></div><div class="mg-mid"><div class="mg-badge">Edisi ' + esc((m.edisi ? String(m.edisi).padStart(2, '0') : '—')) + (m.periode ? ' · ' + esc(m.periode) : '') + '</div><h1>' + esc(m.judul) + '</h1><p class="mg-kicker">' + esc(m.kawasan) + '</p></div><div class="mg-cue">Geser atau tekan panah untuk membaca <span class="mi">arrow_forward</span></div><div class="mg-by"><span>' + esc(ev ? 'Dinas Kelautan dan Perikanan · ' + (m.wilayah_nama || 'UPTD') : m.lembaga) + '</span><span>' + esc(tgl) + '</span></div></div></div>' });
  // Ringkasan
  const stat = '<div class="mg-stats"><div><small>Kawasan</small><b>' + esc(m.kawasan || '-') + '</b></div><div><small>' + (ev ? 'Wilayah UPTD' : 'Mitra pelaksana') + '</small><b>' + esc(ev ? (m.wilayah_nama || '-') : (m.lembaga || '-')) + '</b></div>' + (m.periode ? '<div><small>Periode</small><b>' + esc(m.periode) + '</b></div>' : '') + (m.capaian_persen !== '' && m.capaian_persen !== undefined && !ev ? '<div><small>Capaian</small><b>' + esc(m.capaian_persen) + '%</b></div>' : '') + '</div>';
  pages.push({ k: 'edit', html: '<div class="mg-pg"><div class="mg-eyebrow">' + (ev ? 'Ringkasan Evaluasi' : 'Dari Lapangan') + '</div><h2>' + esc(ev ? 'Gambaran umum hasil evaluasi' : 'Ringkasan kegiatan') + '</h2><div class="mg-dropcap">' + magPara(isi.ringkasan) + '</div>' + stat + '</div>' });
  if (ev && m.capaian_persen !== '' && m.capaian_persen !== undefined) pages.push({ k: 'nilai', html: '<div class="mg-pg center"><div class="mg-eyebrow">Penilaian</div><h2>Capaian kinerja kemitraan</h2>' + magGauge(m.capaian_persen) + '<div class="mg-nilai">' + esc(magNilai(m.capaian_persen)) + '</div>' + (isi.kesimpulan ? '<blockquote>' + esc(isi.kesimpulan) + '</blockquote>' : '') + '</div>' });
  (isi.kegiatan || []).forEach(function (k, i) {
    pages.push({ k: 'keg', html: '<div class="mg-pg mg-keg"><div class="mg-eyebrow">' + (ev ? 'Temuan' : 'Sorotan kegiatan') + '</div>' + (k.foto ? magFig(k.foto, '', 'big') : '') + '<span class="mg-num">' + String(i + 1).padStart(2, '0') + '</span><h2>' + esc(k.judul) + '</h2>' + magPara(k.teks) + '</div>' });
  });
  const gal = (isi.galeri || []);
  for (let i = 0; i < gal.length; i += 4) {
    pages.push({ k: 'gal', html: '<div class="mg-pg"><div class="mg-eyebrow">Galeri</div><h2>' + (i === 0 ? 'Potret kegiatan' : 'Potret kegiatan (lanjutan)') + '</h2><div class="mg-grid">' + gal.slice(i, i + 4).map(function (g) { return magFig(g.id, g.ket, ''); }).join('') + '</div></div>' });
  }
  const blok = [];
  if (!ev && isi.dampak) blok.push(['Dampak & manfaat', isi.dampak]);
  if (isi.kendala) blok.push([ev ? 'Permasalahan' : 'Kendala di lapangan', isi.kendala]);
  if (isi.rekomendasi) blok.push([ev ? 'Rekomendasi tindak lanjut' : 'Rencana & rekomendasi', isi.rekomendasi]);
  if (!ev && isi.kesimpulan) blok.push(['Penutup', isi.kesimpulan]);
  if (blok.length) pages.push({ k: 'rek', html: '<div class="mg-pg"><div class="mg-eyebrow">' + (ev ? 'Catatan evaluator' : 'Tantangan & harapan') + '</div>' + blok.map(function (b, i) { return '<section class="mg-blk' + (i === 0 ? ' first' : '') + '"><h3>' + esc(b[0]) + '</h3>' + magPara(b[1]) + '</section>'; }).join('') + '</div>' });
  // Daftar isi (klik untuk melompat)
  if (pages.length >= 4) {
    const judul = { edit: 'Ringkasan kegiatan', nilai: 'Penilaian', gal: 'Galeri foto', rek: 'Tantangan & harapan' }; let kg = 0;
    const items = []; pages.forEach(function (pg, i) { if (pg.k === 'cover' || pg.k === 'back') return; let t = judul[pg.k]; if (pg.k === 'keg') { t = (isi.kegiatan[kg] || {}).judul || 'Sorotan kegiatan'; kg++; } if (pg.k === 'gal' && items.some(function (x) { return x.k === 'gal'; })) return; items.push({ k: pg.k, t: t, i: i + 1 }); });
    pages.splice(1, 0, { k: 'toc', html: '<div class="mg-pg"><div class="mg-eyebrow">Dalam edisi ini</div><h2>Daftar isi</h2><ol class="mg-toc">' + items.map(function (x, n) { return '<li><button data-mg-pg="' + x.i + '"><span class="n">' + String(n + 1).padStart(2, '0') + '</span><span class="t">' + esc(x.t) + '</span><span class="p">' + (x.i + 1) + '</span></button></li>'; }).join('') + '</ol></div>' });
  }
  pages.push({ k: 'back', html: '<div class="mg-back"><div class="mg-in"><b class="mg-logo">SI-MITRA</b><p>Portal Kemitraan Kawasan Konservasi</p><h3>Dinas Kelautan dan Perikanan<br>Provinsi Sulawesi Tengah</h3><div class="mg-meta">' + esc(J.nama) + ' · Edisi ' + esc((m.edisi ? String(m.edisi).padStart(2, '0') : '—')) + '<br>Terbit ' + esc(tgl) + '</div><button class="mg-btn" data-mg="share">Salin tautan majalah</button><button class="mg-btn ghost" data-mg="top">Kembali ke sampul</button></div>' + magWaves() + '</div>' });
  return pages;
}
function magSpreads() {
  const n = MAG.pages.length; MAG.wide = window.innerWidth >= 1000;
  if (!MAG.wide || n <= 2) return MAG.pages.map(function (p, i) { return [i]; });
  const out = [[0]]; let i = 1; for (; i < n - 1; i += 2) out.push(i + 1 < n - 1 ? [i, i + 1] : [i]); out.push([n - 1]); return out;
}
function magSpreadOf(pageIdx) { for (let i = 0; i < MAG.spreads.length; i++) if (MAG.spreads[i].indexOf(pageIdx) > -1) return i; return 0; }
function magShow(si, dir) {
  const root = magEl(); const book = root.querySelector('.mag-book'); if (!book) return;
  si = Math.max(0, Math.min(MAG.spreads.length - 1, si)); MAG.cur = si;
  const sp = MAG.spreads[si]; const kind = MAG.pages[sp[0]].k;
  book.className = 'mag-book ' + (sp.length === 2 ? 'two' : 'one') + (kind === 'cover' || kind === 'back' ? ' solo ' + kind : '');
  book.innerHTML = '<div class="mag-spread ' + (dir > 0 ? 'in-r' : dir < 0 ? 'in-l' : '') + '">' + sp.map(function (i) { return '<article class="mag-page k-' + MAG.pages[i].k + '">' + MAG.pages[i].html + '</article>'; }).join('') + '</div>';
  magLoadPhotos(book, MAG.preview);
  [si + 1].forEach(function (j) { if (MAG.spreads[j]) MAG.spreads[j].forEach(function (pi) { const tmp = document.createElement('div'); tmp.innerHTML = MAG.pages[pi].html; magLoadPhotos(tmp, MAG.preview); }); });
  const ft = root.querySelector('.mag-foot'); if (ft) {
    const total = MAG.spreads.length; ft.querySelector('.pn').textContent = (sp.length === 2 ? (sp[0] + 1) + '–' + (sp[1] + 1) : (sp[0] + 1)) + ' / ' + MAG.pages.length;
    const bar = ft.querySelector('.bar i'); if (bar) bar.style.width = ((si + 1) / total * 100) + '%';
  }
  root.querySelector('[data-mg="prev"]').disabled = si === 0; root.querySelector('[data-mg="next"]').disabled = si === MAG.spreads.length - 1;
  const st = root.querySelector('.mag-stage'); if (st) st.scrollTop = 0; book.scrollTop = 0;
}
function magLink(id) { return location.origin + location.pathname + '#/majalah/' + id; }
function magOpenReader(data, opt) {
  opt = opt || {}; MAG.data = data; MAG.preview = !!opt.preview; MAG.pages = magBuild(data); MAG.spreads = magSpreads();
  const root = magEl(); root.hidden = false; document.body.classList.add('mag-open');
  const J = MAG_JENIS[data.jenis] || MAG_JENIS.program;
  root.innerHTML = '<div class="mag mag-' + J.warna + '"><header class="mag-bar"><button class="mg-ic" data-mg="close" aria-label="' + (opt.preview ? 'Tutup pratinjau' : 'Tutup') + '"><span class="mi">' + (opt.preview ? 'close' : 'arrow_back') + '</span></button><div class="t"><small>' + esc(J.nama) + (opt.preview ? ' · PRATINJAU' : '') + '</small><b>' + esc(data.judul) + '</b></div><span class="sp"></span>' + (opt.preview ? '' : '<button class="mg-ic" data-mg="share" aria-label="Salin tautan" title="Salin tautan"><span class="mi">link</span></button>') + '<button class="mg-ic" data-mg="print" aria-label="Cetak atau simpan PDF" title="Cetak / simpan PDF"><span class="mi">print</span></button></header>' +
    '<div class="mag-stage"><button class="mag-nav prev" data-mg="prev" aria-label="Halaman sebelumnya"><span class="mi">chevron_left</span></button><div class="mag-book"></div><button class="mag-nav next" data-mg="next" aria-label="Halaman berikutnya"><span class="mi">chevron_right</span></button></div>' +
    '<footer class="mag-foot"><span class="pn"></span><div class="bar"><i></i></div><small class="hint">Geser atau gunakan tombol panah</small></footer></div>';
  magShow(0, 0); root.querySelector('.mag-book').focus && root.querySelector('.mag-book').setAttribute('tabindex', '0');
}
function magClose() {
  const root = magEl(); root.hidden = true; root.innerHTML = ''; document.body.classList.remove('mag-open'); MAG.data = null;
  const pr = document.getElementById('magPrint'); if (pr) pr.remove();
}
function magPrint() {
  if (!MAG.data) return; let pr = document.getElementById('magPrint'); if (pr) pr.remove();
  pr = document.createElement('div'); pr.id = 'magPrint'; pr.className = 'mag-' + (MAG_JENIS[MAG.data.jenis] || MAG_JENIS.program).warna;
  pr.innerHTML = MAG.pages.map(function (p) { return '<article class="mag-page k-' + p.k + '">' + p.html + '</article>'; }).join(''); document.body.appendChild(pr);
  magLoadPhotos(pr, MAG.preview);
  const imgs = pr.querySelectorAll('[data-foto]'); const done = function () { document.body.classList.add('mag-printing'); setTimeout(function () { window.print(); document.body.classList.remove('mag-printing'); }, 150); };
  const t0 = Date.now(); (function wait() { if (!pr.querySelectorAll('[data-foto]:not(.ok):not(.err)').length || Date.now() - t0 > 8000) done(); else setTimeout(wait, 150); })();
}
function magNavKey(e) {
  if (!MAG.data) return; if (e.key === 'Escape') { magAct('close'); } else if (e.key === 'ArrowRight') magShow(MAG.cur + 1, 1); else if (e.key === 'ArrowLeft') magShow(MAG.cur - 1, -1);
}
function magAct(a) {
  if (a === 'close') { if (MAG.preview) magClose(); else if (MAG.fromApp) { MAG.fromApp = false; location.hash = ''; } else { if (location.hash.indexOf('#/majalah/') === 0) location.hash = S.token ? '#/majalah' : ''; else magClose(); } }
  else if (a === 'prev') magShow(MAG.cur - 1, -1); else if (a === 'next') magShow(MAG.cur + 1, 1); else if (a === 'top') magShow(0, -1);
  else if (a === 'print') magPrint();
  else if (a === 'share') { const u = magLink(MAG.data.id); (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('ok', 'Tautan majalah disalin.'); }).catch(function () { window.prompt('Salin tautan majalah:', u); }); }
}

/* ----------------------------- Galeri publik ----------------------------- */
function magCard(r) {
  const J = MAG_JENIS[r.jenis] || MAG_JENIS.program;
  return '<a class="mg-card mag-' + J.warna + '" href="#/majalah/' + esc(r.id) + '" data-mid="' + esc(r.id) + '"><div class="cv">' + (r.sampul ? '<div class="img" data-foto="' + esc(r.sampul) + '"></div>' : magWaves()) + '<div class="mg-shade"></div><span class="ed">Edisi ' + esc((r.edisi ? String(r.edisi).padStart(2, '0') : '—')) + '</span><span class="jn">' + esc(J.nama) + '</span><h3>' + esc(r.judul) + '</h3></div><div class="mt"><b>' + esc(r.lembaga) + '</b><small>' + esc(r.kawasan) + ' · ' + esc(r.periode || fmtD(r.terbit)) + '</small>' + (r.ringkas ? '<p class="ex">' + esc(r.ringkas) + (String(r.ringkas).length >= 170 ? '…' : '') + '</p>' : '') + '<span class="rd">Baca edisi <span class="mi">arrow_forward</span></span></div></a>';
}
function magCards(L, q) {
  q = String(q || '').toLowerCase().trim();
  const F = L.filter(function (r) { return !q || (r.judul + ' ' + r.lembaga + ' ' + r.kawasan + ' ' + r.periode + ' ' + (r.ringkas || '')).toLowerCase().indexOf(q) > -1; });
  return F.length ? F.map(magCard).join('') : '<div class="pub-empty">Tidak ada edisi yang cocok dengan pencarian.</div>';
}
function magGaleri() {
  const root = magEl(); root.hidden = false; document.body.classList.add('mag-open'); root.classList.add('gal');
  const L = (MAG.daftar || []).filter(function (r) { return r.jenis === 'program'; }), top = L[0];
  const mit = {}, kaw = {}; L.forEach(function (r) { mit[r.lembaga] = 1; kaw[r.kawasan] = 1; });
  const dalamApp = !!(S.token && S.me);
  const btnMasuk = dalamApp ? '<button class="mg-btn" data-mg="app"><span class="mi">dashboard</span> Kembali ke aplikasi</button>' : '<button class="mg-btn ghost" data-mg="masuk"><span class="mi">how_to_reg</span> Daftar mitra</button><button class="mg-btn" data-mg="masuk"><span class="mi">login</span> Masuk</button>';
  const hero = top
    ? '<div class="lp-fx"><div class="lp-ghost g2"></div><div class="lp-ghost g1"></div><a class="mg-card mag-program lp-feat" href="#/majalah/' + esc(top.id) + '"><div class="cv">' + (top.sampul ? '<div class="img" data-foto="' + esc(top.sampul) + '"></div>' : magWaves()) + '<div class="mg-shade"></div><span class="ed">Edisi ' + esc(top.edisi ? String(top.edisi).padStart(2, '0') : '—') + ' · Terbaru</span><span class="jn">' + esc(MAG_JENIS.program.nama) + '</span><h3>' + esc(top.judul) + '</h3></div></a></div>'
    : '<div class="lp-fx"><div class="lp-soon"><span class="mi">auto_stories</span><b>Edisi pertama segera hadir</b><small>Laporan dari para mitra akan terbit di sini.</small></div></div>';
  const stats = '<div class="lp-stats"><div><b>' + L.length + '</b><small>Edisi terbit</small></div><div><b>' + Object.keys(mit).length + '</b><small>Mitra melapor</small></div><div><b>' + Object.keys(kaw).length + '</b><small>Kawasan konservasi</small></div></div>';
  root.innerHTML = '<div class="mag-pub lp"><header class="pub-h"><div class="pub-brand"><span class="mg-logo">SI</span><div><b>SI-MITRA KONSERVASI</b><small>DKP Provinsi Sulawesi Tengah</small></div></div><nav class="pub-nav"><a data-mg-go="lpEdisi">Edisi</a><a data-mg-go="lpTentang">Tentang</a><a data-mg-go="lpMitra">Bermitra</a></nav><span class="sp"></span><div class="pub-cta">' + btnMasuk + '</div></header>' +
    '<section class="lp-hero"><div class="lp-hin"><div class="lp-txt"><span class="mg-eyebrow">Majalah Digital · Terbuka untuk Umum</span><h1>Kisah kemitraan konservasi <em>Sulawesi Tengah</em></h1><p>Cerita, foto, dan capaian nyata dari kelompok masyarakat, lembaga, dan pelaku usaha yang menjaga terumbu karang, pesisir, dan laut kita.</p><div class="lp-btns">' + (top ? '<a class="mg-btn lg" href="#/majalah/' + esc(top.id) + '"><span class="mi">menu_book</span> Baca edisi terbaru</a>' : '') + '<a class="mg-btn ghost lg" data-mg-go="lpEdisi"><span class="mi">grid_view</span> Jelajahi edisi</a></div>' + stats + '</div>' + hero + '</div>' + magWaves() + '</section>' +
    '<main class="pub-m"><section id="lpEdisi" class="lp-sec"><div class="lp-h"><div><span class="mg-eyebrow dk">Perpustakaan</span><h2>Semua edisi</h2></div><label class="lp-q"><span class="mi">search</span><input type="search" id="lpQ" data-mg-q placeholder="Cari judul, mitra, kawasan…" aria-label="Cari edisi" value="' + esc(MAG.q || '') + '"></label></div>' +
    (MAG.daftar === null ? '<div class="pub-empty">Memuat majalah…</div>' : L.length ? '<div class="mg-gridc" id="lpGrid">' + magCards(L, MAG.q) + '</div>' : '<div class="pub-empty">Belum ada majalah yang diterbitkan.</div>') + '</section>' +
    '<section id="lpTentang" class="lp-sec"><div class="lp-h"><div><span class="mg-eyebrow dk">Mengapa membaca</span><h2>Laporan yang bercerita</h2></div></div><div class="lp-feat3"><div><span class="mi">photo_camera</span><b>Dari lapangan</b><p>Foto dan kisah langsung dari lokasi kegiatan para mitra.</p></div><div><span class="mi">insights</span><b>Capaian terukur</b><p>Dampak, kendala, dan rencana tindak lanjut disajikan apa adanya.</p></div><div><span class="mi">public</span><b>Terbuka untuk siapa saja</b><p>Tanpa login. Bagikan tautan edisi ke rekan, media, atau masyarakat.</p></div></div></section>' +
    '<section id="lpMitra" class="lp-band"><div class="lp-bin"><div><span class="mg-eyebrow">Ingin kegiatan Anda terbit di sini?</span><h2>Bermitra dengan DKP Sulawesi Tengah</h2><p>Ajukan kemitraan, laksanakan program, lalu laporkan hasilnya. Laporan yang disetujui terbit sebagai edisi majalah.</p></div><ol class="lp-steps"><li><b>1</b>Ajukan kemitraan</li><li><b>2</b>Telaah &amp; kesepakatan</li><li><b>3</b>Laksanakan program</li><li><b>4</b>Laporan terbit</li></ol><div class="lp-btns">' + (dalamApp ? '<button class="mg-btn lg" data-mg="app">Kembali ke aplikasi</button>' : '<button class="mg-btn lg" data-mg="masuk"><span class="mi">login</span> Masuk / Daftar mitra</button>') + '</div></div></section></main>' +
    '<footer class="pub-f">© Dinas Kelautan dan Perikanan Provinsi Sulawesi Tengah · SI-MITRA KONSERVASI</footer></div>';
  magLoadPhotos(root, false);
}
function magRoute() {
  const h = location.hash; const m = h.match(/^#\/majalah\/([\w-]+)/); const root = magEl();
  const home = !S.token && (h === '' || h === '#' || h === '#/');
  if (h === '#/masuk' || (!m && h.indexOf('#/majalah') !== 0 && !home)) { if (!MAG.preview && !root.hidden) magClose(); root.classList.remove('gal'); if (h === '#/masuk' && S.token) history.replaceState(null, '', location.pathname + location.search); return; }
  if (m) {
    root.classList.remove('gal'); root.hidden = false; document.body.classList.add('mag-open'); root.innerHTML = '<div class="pub-load">Membuka majalah…</div>';
    api('majalah_baca', { id: m[1] }).then(function (d) { if (location.hash.indexOf(m[1]) > -1) magOpenReader(d, {}); }).catch(function (e) { root.innerHTML = '<div class="pub-load">' + esc(e.message) + '<br><button class="mg-btn" data-mg="galeri">Lihat semua majalah</button></div>'; });
    return;
  }
  MAG.data = null; magGaleri();
  api('majalah_daftar').then(function (L) { MAG.daftar = L; if (root.classList.contains('gal') && !MAG.data) { const y = root.scrollTop; magGaleri(); root.scrollTop = y; } }).catch(function (e) { MAG.daftar = []; if (root.classList.contains('gal')) magGaleri(); toast('bad', e.message); });
}
function magInit() {
  const root = magEl();
  root.addEventListener('click', function (e) {
    const go = e.target.closest('[data-mg-go]'); if (go) { e.preventDefault(); const t = document.getElementById(go.dataset.mgGo); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const pg = e.target.closest('[data-mg-pg]'); if (pg) { magShow(magSpreadOf(Number(pg.dataset.mgPg)), 1); return; }
    const b = e.target.closest('[data-mg]'); if (!b) return; const a = b.dataset.mg;
    if (a === 'masuk') { location.hash = '#/masuk'; }
    else if (a === 'app') { MAG.fromApp = false; history.replaceState(null, '', location.pathname + location.search); magClose(); root.classList.remove('gal'); }
    else if (a === 'galeri') location.hash = S.token ? '#/majalah' : '';
    else magAct(a);
  });
  root.addEventListener('input', function (e) { if (!e.target.matches('[data-mg-q]')) return; MAG.q = e.target.value; const g = document.getElementById('lpGrid'); if (g) { g.innerHTML = magCards((MAG.daftar || []).filter(function (r) { return r.jenis === 'program'; }), MAG.q); magLoadPhotos(g, false); } });
  let x0 = null; root.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', function (e) { if (x0 === null || !MAG.data) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) magShow(MAG.cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('keydown', magNavKey);
  window.addEventListener('hashchange', magRoute);
  let wasWide = window.innerWidth >= 1000; window.addEventListener('resize', debounce(function () { const w = window.innerWidth >= 1000; if (MAG.data && w !== wasWide) { const pi = MAG.spreads[MAG.cur][0]; MAG.spreads = magSpreads(); magShow(magSpreadOf(pi), 0); } wasWide = w; }, 200));
  magRoute();
}
