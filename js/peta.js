/* =====================================================================
 * MapKit — peta (Leaflet, self-host di vendor/leaflet) untuk SI-MITRA
 * - Geometri: luas (ha), titik-dalam-poligon, simplifikasi (Douglas–Peucker)
 * - Impor: GeoJSON (Geometry/Feature/FeatureCollection) atau daftar "lintang,bujur"
 * - Editor poligon: klik untuk menambah titik, seret untuk menggeser, klik kanan untuk menghapus titik
 * - Peta ikhtisar: batas kawasan + area pengelolaan pengajuan
 * Format simpan: GeoJSON Polygon/MultiPolygon, koordinat [bujur, lintang] (6 desimal)
 * ===================================================================== */
'use strict';

const MapKit = (function () {
  const CENTER = [-1.1, 121.4], ZOOM = 7;
  const MAX_VERT = 5000;
  const live = [], liveModal = [];
  const WARNA = { 'Berjalan': '#0e8f94', 'Perlu dilengkapi': '#E8A33D', 'Pelaksanaan': '#10B981', 'Selesai': '#2f7de1', 'Tidak dilanjutkan': '#d64545', 'Draft': '#7a8a9c' };

  /* ------------------------------ geometri ------------------------------ */
  function ringAreaM2(r) { const R = 6378137, d = Math.PI / 180; let t = 0; for (let i = 0; i < r.length - 1; i++) t += (r[i + 1][0] - r[i][0]) * d * (2 + Math.sin(r[i][1] * d) + Math.sin(r[i + 1][1] * d)); return Math.abs(t * R * R / 2); }
  function polysOf(g) {
    const out = []; (function walk(x) {
      if (!x || typeof x !== 'object') return;
      if (x.type === 'FeatureCollection') (x.features || []).forEach(walk); else if (x.type === 'Feature') walk(x.geometry);
      else if (x.type === 'Polygon') out.push(x.coordinates); else if (x.type === 'MultiPolygon') (x.coordinates || []).forEach(function (c) { out.push(c); });
    })(g); return out;
  }
  function areaHa(g) { let m2 = 0; polysOf(g).forEach(function (rings) { rings.forEach(function (r, i) { m2 += i === 0 ? ringAreaM2(r) : -ringAreaM2(r); }); }); return Math.round(Math.max(0, m2) / 100) / 100; }
  function countVert(g) { let n = 0; polysOf(g).forEach(function (rs) { rs.forEach(function (r) { n += r.length; }); }); return n; }
  function countPts(g) { let n = 0; polysOf(g).forEach(function (rs) { rs.forEach(function (r) { n += Math.max(0, r.length - 1); }); }); return n; }
  function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if (((r[i][1] > y) !== (r[j][1] > y)) && (x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0])) c = !c; } return c; }
  function pointIn(g, lng, lat) { return polysOf(g).some(function (rings) { return inRing(lng, lat, rings[0]) && !rings.slice(1).some(function (h) { return inRing(lng, lat, h); }); }); }
  function parse(s) { if (!s) return null; if (typeof s === 'object') return s; try { return JSON.parse(s); } catch (e) { return null; } }
  function latlngs(g) { // untuk L.polygon
    const conv = function (rings) { return rings.map(function (r) { return r.map(function (p) { return [p[1], p[0]]; }); }); };
    const polys = polysOf(g).map(conv); return polys.length === 1 ? polys[0] : polys;
  }
  function boundsOf(g) { const b = L.latLngBounds([]); polysOf(g).forEach(function (rs) { rs[0].forEach(function (p) { b.extend([p[1], p[0]]); }); }); return b; }
  function dp(pts, tol) { // Douglas–Peucker (derajat)
    if (pts.length < 3) return pts;
    const sq = function (p, a, b) { let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y; if (dx || dy) { const t = Math.max(0, Math.min(1, ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy))); x += dx * t; y += dy * t; } dx = p[0] - x; dy = p[1] - y; return dx * dx + dy * dy; };
    const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true; const st = [[0, pts.length - 1]];
    while (st.length) { const s = st.pop(); let mx = 0, ix = -1; for (let i = s[0] + 1; i < s[1]; i++) { const d = sq(pts[i], pts[s[0]], pts[s[1]]); if (d > mx) { mx = d; ix = i; } } if (mx > tol * tol && ix > -1) { keep[ix] = true; st.push([s[0], ix], [ix, s[1]]); } }
    return pts.filter(function (_, i) { return keep[i]; });
  }
  /** Normalisasi → Polygon/MultiPolygon bersih (6 desimal, cincin tertutup), disederhanakan bila melebihi batas. */
  function normalize(input, maxChars) {
    const polys = polysOf(parse(input) || input); if (!polys.length) throw new Error('Tidak ditemukan poligon (Polygon/MultiPolygon).');
    const build = function (tol) {
      const clean = polys.map(function (rings) { return rings.map(function (ring) {
        let r = ring.map(function (p) { const x = +p[0], y = +p[1]; if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 90) throw new Error('Koordinat di luar rentang. Pastikan urutan [bujur, lintang].'); return [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]; });
        if (r.length > 1 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push([r[0][0], r[0][1]]);
        if (tol) { r = dp(r, tol); if (r.length < 4) r = ring.map(function (p) { return [Math.round(+p[0] * 1e6) / 1e6, Math.round(+p[1] * 1e6) / 1e6]; }); }
        if (r.length < 4) throw new Error('Setiap poligon minimal 3 titik.'); return r; }); });
      return clean.length === 1 ? { type: 'Polygon', coordinates: clean[0] } : { type: 'MultiPolygon', coordinates: clean };
    };
    let g = build(0), tol = 0.00001, note = '';
    while ((countVert(g) > MAX_VERT || JSON.stringify(g).length > maxChars) && tol < 0.05) { tol *= 1.8; g = build(tol); note = 'disederhanakan'; }
    if (countVert(g) > MAX_VERT || JSON.stringify(g).length > maxChars) throw new Error('Poligon terlalu kompleks untuk disimpan. Potong atau sederhanakan di aplikasi GIS lalu impor ulang.');
    return { geom: g, note: note, luas: areaHa(g), vert: countVert(g) };
  }
  /** Teks bebas → geometri. Menerima GeoJSON atau baris "lintang,bujur" (min. 3 titik). */
  function parseText(text) {
    const t = String(text || '').trim(); if (!t) throw new Error('Data kosong.');
    if (t[0] === '{' || t[0] === '[') { try { return JSON.parse(t); } catch (e) { throw new Error('GeoJSON tidak valid: ' + e.message); } }
    const pts = t.split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { const m = l.split(/[\s,;]+/).map(Number); if (m.length < 2 || !isFinite(m[0]) || !isFinite(m[1])) throw new Error('Baris tidak valid: "' + l + '". Format: lintang,bujur'); return [m[1], m[0]]; });
    if (pts.length < 3) throw new Error('Minimal 3 titik koordinat.'); pts.push(pts[0].slice()); return { type: 'Polygon', coordinates: [pts] };
  }
  /** Kesesuaian dengan batas kawasan (berdasarkan titik-titik sudut). */
  function cek(geom, kawasan, batas) {
    const b = (batas || []).filter(function (x) { return x.kawasan === kawasan && x.geojson; })[0];
    if (!b) return { status: 'tanpa_batas', teks: 'Batas kawasan "' + kawasan + '" belum diunggah Admin, kesesuaian ruang belum dapat diperiksa.' };
    const bg = parse(b.geojson); let tot = 0, dalam = 0;
    polysOf(geom).forEach(function (rs) { rs[0].slice(0, -1).forEach(function (p) { tot++; if (pointIn(bg, p[0], p[1])) dalam++; }); });
    if (!tot) return { status: 'tanpa_batas', teks: '' };
    if (dalam === tot) return { status: 'dalam', teks: 'Seluruh titik area berada di dalam batas ' + kawasan + '.' };
    if (!dalam) return { status: 'luar', teks: 'Area berada di luar batas ' + kawasan + '. Periksa pilihan kawasan atau posisi area.' };
    return { status: 'sebagian', teks: dalam + ' dari ' + tot + ' titik berada di dalam batas ' + kawasan + '. Sebagian area keluar dari kawasan.' };
  }
  function lokasiInfo(lat, lng, batas, areas) {
    return {
      kawasan: (batas || []).filter(function (b) { return b.geojson && pointIn(parse(b.geojson), lng, lat); }).map(function (b) { return b.kawasan; }),
      areas: (areas || []).filter(function (a) { return a.geojson && pointIn(parse(a.geojson), lng, lat); })
    };
  }

  /* ------------------------------ peta dasar ------------------------------ */
  function create(el, opts) {
    opts = opts || {};
    if (!window.L) { el.innerHTML = '<div class="empty">' + mi('map') + 'Pustaka peta gagal dimuat.</div>'; return null; }
    L.Icon.Default.imagePath = 'vendor/leaflet/images/';
    const map = L.map(el, { center: CENTER, zoom: ZOOM, zoomControl: true, attributionControl: true, scrollWheelZoom: opts.scroll !== false, tap: true, zoomAnimation: false, markerZoomAnimation: false });
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; kontributor <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Citra &copy; Esri, Maxar, Earthstar Geographics' });
    (opts.satelit ? sat : osm).addTo(map);
    L.control.layers({ 'Peta jalan': osm, 'Citra satelit': sat }, null, { collapsed: true }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    (opts.modal ? liveModal : live).push(map); setTimeout(function () { try { if (map._mapPane) map.invalidateSize(); } catch (e) {} }, 80);
    return map;
  }
  function disposeAll() { while (live.length) { const m = live.pop(); try { m.remove(); } catch (e) {} } }
  function disposeModal() { while (liveModal.length) { const m = liveModal.pop(); try { m.remove(); } catch (e) {} } }

  function styleBatas() { return { color: '#0a6f73', weight: 2, dashArray: '6 4', fillColor: '#0e8f94', fillOpacity: 0.08 }; }
  function warnaArea(a) { return a.status === 'Draft' ? WARNA.Draft : (WARNA[groupOf(a)] || '#0e8f94'); }

  /** Peta ikhtisar: batas kawasan + area pengajuan. */
  function overview(el, o) {
    const map = create(el, { scroll: o.scroll, satelit: o.satelit }); if (!map) return null;
    const gB = L.featureGroup().addTo(map), gA = L.featureGroup().addTo(map);
    function draw(batas, areas) {
      gB.clearLayers(); gA.clearLayers();
      (batas || []).forEach(function (b) { const g = parse(b.geojson); if (!g) return; L.polygon(latlngs(g), styleBatas()).bindTooltip(esc(b.kawasan) + (b.luas_ha ? ' · ' + Number(b.luas_ha).toLocaleString('id-ID') + ' Ha' : ''), { sticky: true }).addTo(gB); });
      (areas || []).forEach(function (a) {
        const g = parse(a.geojson); if (!g) return; const c = warnaArea(a);
        const poly = L.polygon(latlngs(g), { color: c, weight: 2, fillColor: c, fillOpacity: 0.35 }).addTo(gA);
        poly.bindPopup('<div class="pop"><b>' + esc(a.judul) + '</b><br>' + esc(a.nomor) + ' · ' + esc(a.lembaga) + '<br>' + esc(a.nama) + ' · ' + Number(a.luas_ha || 0).toLocaleString('id-ID') + ' Ha<br><span class="chip ' + statusClass(a) + '">' + esc(a.status) + '</span><br><button class="btn btn-p btn-s" data-pop-open="' + esc(a.id_pengajuan) + '" style="margin-top:6px">Buka pengajuan</button></div>');
      });
      const all = L.featureGroup([gB, gA]); const bb = (gB.getLayers().length || gA.getLayers().length) ? all.getBounds() : null; if (bb && bb.isValid()) map.fitBounds(bb.pad(0.15), { maxZoom: 13 });
    }
    map.on('popupopen', function (e) { const b = e.popup.getElement().querySelector('[data-pop-open]'); if (b) b.onclick = function () { map.closePopup(); if (o.onOpen) o.onOpen(b.dataset.popOpen); }; });
    if (o.onClick) map.on('click', function (e) { o.onClick(e.latlng.lat, e.latlng.lng); });
    draw(o.batas, o.areas);
    return { map: map, update: draw };
  }

  /* ------------------------------ editor poligon ------------------------------ */
  /** Widget editor lengkap di dalam host. opts: {geom, kawasan, batas, onChange(geom|null, luas), maxChars, satelit, readonly} */
  function editor(host, opts) {
    opts = opts || {}; const maxChars = opts.maxChars || 40000;
    host.innerHTML = (opts.readonly ? '' : '<div class="mapbar"><button type="button" class="btn btn-p btn-s" data-m="draw">' + mi('draw') + ' Gambar area</button><button type="button" class="btn btn-o btn-s" data-m="undo">' + mi('undo') + ' Urungkan</button><button type="button" class="btn btn-o btn-s" data-m="clear">' + mi('delete') + ' Hapus</button><button type="button" class="btn btn-o btn-s" data-m="import">' + mi('upload_file') + ' Impor</button><button type="button" class="btn btn-o btn-s" data-m="locate">' + mi('my_location') + ' Lokasi saya</button></div>') +
      '<div class="mapbox"></div><div class="mapinfo" aria-live="polite"></div><div class="mapcheck"></div>';
    const box = host.querySelector('.mapbox'), info = host.querySelector('.mapinfo'), chk = host.querySelector('.mapcheck');
    const map = create(box, { satelit: opts.satelit, modal: opts.modal }); if (!map) return null;
    const gBatas = L.featureGroup().addTo(map);
    function setBatas(list) { gBatas.clearLayers(); opts.batas = list || []; opts.batas.forEach(function (b) { const g = parse(b.geojson); if (g) L.polygon(latlngs(g), styleBatas()).bindTooltip(esc(b.kawasan), { sticky: true }).addTo(gBatas); }); summary(); }
    let pts = [], complex = null, drawing = false, poly = null, markers = [];
    const COL = '#F26B4F';
    const g0 = parse(opts.geom);
    if (g0) { const ps = polysOf(g0); if (ps.length === 1 && ps[0].length === 1) pts = ps[0][0].slice(0, -1).map(function (p) { return [p[1], p[0]]; }); else complex = g0; }
    function current() { if (complex) return complex; if (pts.length < 3) return null; const ring = pts.map(function (p) { return [p[1], p[0]]; }); ring.push(ring[0].slice()); return { type: 'Polygon', coordinates: [ring] }; }
    function render(fit) {
      if (poly) { map.removeLayer(poly); poly = null; } markers.forEach(function (m) { map.removeLayer(m); }); markers = [];
      if (complex) { poly = L.polygon(latlngs(complex), { color: COL, weight: 2, fillOpacity: 0.3 }).addTo(map); if (fit) map.fitBounds(poly.getBounds().pad(0.2)); }
      else {
        if (pts.length >= 3) poly = L.polygon(pts, { color: COL, weight: 2, fillOpacity: 0.3 }).addTo(map); else if (pts.length === 2) poly = L.polyline(pts, { color: COL, weight: 2, dashArray: '4 4' }).addTo(map);
        pts.forEach(function (p, i) {
          if (opts.readonly) return;
          const m = L.marker(p, { draggable: true, icon: L.divIcon({ className: 'vtx', iconSize: [16, 16] }), keyboard: false }).addTo(map); markers.push(m);
          m.on('drag', function (e) { pts[i] = [e.latlng.lat, e.latlng.lng]; if (poly) poly.setLatLngs(pts); });
          m.on('dragend', function () { changed(); });
          m.on('contextmenu', function () { pts.splice(i, 1); render(); changed(); });
        });
        if (fit && pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 16 });
      }
      summary();
    }
    function summary() {
      const g = current();
      if (!g) { info.textContent = opts.readonly ? 'Belum ada area digambar.' : (drawing ? 'Klik pada peta untuk menambah titik (minimal 3). Klik "Selesai" bila sudah.' : 'Belum ada area. Klik "Gambar area" atau "Impor".'); chk.innerHTML = ''; return; }
      info.innerHTML = '<b>' + areaHa(g).toLocaleString('id-ID') + ' Ha</b> · ' + countPts(g) + ' titik' + (complex ? ' · area kompleks hasil impor (ganti lewat Impor atau Hapus)' : (opts.readonly ? '' : ' · seret titik untuk menggeser, klik kanan titik untuk menghapus'));
      if (opts.kawasan) { const c = cek(g, opts.kawasan, opts.batas); const cls = { dalam: 'ok', sebagian: 'warn', luar: 'bad', tanpa_batas: 'info' }[c.status]; chk.innerHTML = c.teks ? '<div class="callout ' + cls + '">' + mi(c.status === 'dalam' ? 'check_circle' : c.status === 'tanpa_batas' ? 'info' : 'warning') + '<span>' + esc(c.teks) + '</span></div>' : ''; }
    }
    function changed() { const g = current(); summary(); if (opts.onChange) opts.onChange(g, g ? areaHa(g) : 0); }
    function setDrawing(on) { drawing = on; box.classList.toggle('drawing', on); const b = host.querySelector('[data-m="draw"]'); if (b) b.innerHTML = on ? mi('check') + ' Selesai' : mi('draw') + ' Gambar area'; summary(); }
    map.on('click', function (e) { if (!drawing || complex || opts.readonly) return; pts.push([e.latlng.lat, e.latlng.lng]); render(); changed(); });
    function doImport() {
      let pn = host.querySelector('.imp'); if (pn) { pn.remove(); return; }
      pn = document.createElement('div'); pn.className = 'imp card';
      pn.innerHTML = '<p class="sub" style="margin-bottom:8px">Tempel <b>GeoJSON</b> (Polygon / MultiPolygon / Feature / FeatureCollection, koordinat [bujur, lintang]) <b>atau</b> daftar titik, satu per baris: <code>lintang,bujur</code>. Atau pilih berkas .geojson / .json.</p>' +
        '<textarea class="in" data-imp="txt" rows="6" placeholder="-0.8917,119.8707&#10;-0.8920,119.8750&#10;-0.8950,119.8730"></textarea><input type="file" data-imp="file" accept=".geojson,.json,.txt,application/json" style="margin-top:8px">' +
        '<div class="errtxt" data-imp="err" role="alert"></div><div class="btns" style="margin-top:8px"><button type="button" class="btn btn-o btn-s" data-imp="cancel">Batal</button><button type="button" class="btn btn-p btn-s" data-imp="ok">Gunakan</button></div>';
      host.insertBefore(pn, box); const q = function (k) { return pn.querySelector('[data-imp="' + k + '"]'); };
      q('cancel').onclick = function () { pn.remove(); };
      q('file').onchange = function () { const f = this.files[0]; if (!f) return; if (f.size > 3 * 1024 * 1024) { q('err').textContent = 'Berkas terlalu besar (maks. 3 MB).'; return; } const r = new FileReader(); r.onload = function () { q('txt').value = r.result; }; r.readAsText(f); };
      q('ok').onclick = function () {
        let g; try { g = normalize(parseText(q('txt').value), maxChars); } catch (e) { q('err').textContent = e.message; return; }
        complex = null; const ps = polysOf(g.geom); if (ps.length === 1 && ps[0].length === 1) { pts = ps[0][0].slice(0, -1).map(function (p) { return [p[1], p[0]]; }); } else { pts = []; complex = g.geom; }
        setDrawing(false); render(true); changed(); if (g.note) toast('', 'Poligon ' + g.note + ' agar muat (' + g.vert + ' titik).'); pn.remove();
      };
      q('txt').focus();
    }
    host.addEventListener('click', function (e) {
      const b = e.target.closest('[data-m]'); if (!b) return; const a = b.dataset.m;
      if (a === 'draw') { if (complex) { toast('bad', 'Area hasil impor tidak dapat digambar ulang. Hapus dulu atau impor ulang.'); return; } setDrawing(!drawing); }
      else if (a === 'undo') { pts.pop(); render(); changed(); }
      else if (a === 'clear') { pts = []; complex = null; setDrawing(false); render(); changed(); }
      else if (a === 'import') doImport();
      else if (a === 'locate') { map.locate({ setView: true, maxZoom: 16 }); }
    });
    map.on('locationerror', function () { toast('bad', 'Lokasi tidak tersedia. Izinkan akses lokasi pada browser.'); });
    setBatas(opts.batas); render(true); if (!pts.length && !complex && opts.fokus) map.setView(opts.fokus, 10);
    else if (!pts.length && !complex && opts.batas && opts.kawasan) { const b = opts.batas.filter(function (x) { return x.kawasan === opts.kawasan && x.geojson; })[0]; if (b) map.fitBounds(boundsOf(parse(b.geojson)).pad(0.1)); }
    function fitBatas() { if (pts.length || complex || !opts.kawasan) return; const b = (opts.batas || []).filter(function (x) { return x.kawasan === opts.kawasan && x.geojson; })[0]; if (b) map.fitBounds(boundsOf(parse(b.geojson)).pad(0.1)); }
    return { map: map, setBatas: function (l) { setBatas(l); fitBatas(); }, geom: current, luas: function () { const g = current(); return g ? areaHa(g) : 0; }, refresh: summary, setKawasan: function (k) { opts.kawasan = k; summary(); }, invalidate: function () { map.invalidateSize(); } };
  }

  return { create: create, overview: overview, editor: editor, disposeAll: disposeAll, disposeModal: disposeModal, normalize: normalize, parseText: parseText, areaHa: areaHa, pointIn: pointIn, cek: cek, lokasiInfo: lokasiInfo, parse: parse, boundsOf: boundsOf, latlngs: latlngs, WARNA: WARNA };
})();
