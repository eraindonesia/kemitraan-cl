/* =====================================================================
 * MapKit — peta (Leaflet, self-host di vendor/leaflet) untuk SI-MITRA
 * - Geometri: luas (ha), titik-dalam-poligon, simplifikasi (Douglas–Peucker)
 * - Impor: GeoJSON (Geometry/Feature/FeatureCollection), Shapefile, KML/KMZ, atau daftar "lintang,bujur"
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
  const BB = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function bboxOf(r) { let b = BB && BB.get(r); if (b) return b; b = [Infinity, Infinity, -Infinity, -Infinity]; for (let i = 0; i < r.length; i++) { const p = r[i]; if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; } if (BB) BB.set(r, b); return b; }
  function pointIn(g, lng, lat) { return polysOf(g).some(function (rings) { const b = bboxOf(rings[0]); if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) return false; return inRing(lng, lat, rings[0]) && !rings.slice(1).some(function (h) { return inRing(lng, lat, h); }); }); }
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
  /** Normalisasi → Polygon/MultiPolygon bersih (6 desimal, cincin tertutup); bila ada kategori → FeatureCollection (1 Feature per kategori). Disederhanakan bila melebihi batas. */
  function normalize(input, maxChars, maxVert) {
    maxVert = maxVert || MAX_VERT;
    const groups = groupsOf(parse(input) || input).filter(function (x) { return x.polys.length; }); if (!groups.length) throw new Error('Tidak ditemukan poligon (Polygon/MultiPolygon).');
    if (groups.length > 40) throw new Error('Terlalu banyak kategori (' + groups.length + '). Pilih kolom kategori lain atau kosongkan (maks. 40).');
    const bernama = groups.some(function (x) { return x.kat; });
    // 1) validasi + bulatkan 6 desimal + tutup cincin — sekali saja (data bisa jutaan titik)
    let cur = groups.map(function (grp) { return { kat: grp.kat, polys: grp.polys.map(function (rings) { return rings.map(function (ring) {
      const r = new Array(ring.length); for (let i = 0; i < ring.length; i++) { const x = +ring[i][0], y = +ring[i][1]; if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 90) throw new Error('Koordinat di luar rentang. Pastikan urutan [bujur, lintang].'); r[i] = [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]; }
      if (r.length > 1 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push([r[0][0], r[0][1]]);
      if (r.length < 4) throw new Error('Setiap poligon minimal 3 titik.'); return r; }); }) }; });
    const cnt = function (gs) { let n = 0; gs.forEach(function (x) { x.polys.forEach(function (rs) { rs.forEach(function (r) { n += r.length; }); }); }); return n; };
    const out = function (gs, dec) {
      const rd = Math.pow(10, dec); const feats = gs.map(function (grp) { const polys = grp.polys.map(function (rings) { return rings.map(function (r) { return dec >= 6 ? r : r.map(function (p) { return [Math.round(p[0] * rd) / rd, Math.round(p[1] * rd) / rd]; }); }); });
        return { kat: grp.kat, geom: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys } }; });
      return bernama ? { type: 'FeatureCollection', features: feats.map(function (f) { return { type: 'Feature', properties: { kategori: f.kat || 'Lainnya' }, geometry: f.geom }; }) } : feats[0].geom;
    };
    // perkiraan murah: ≥14 karakter/titik → stringify mahal hanya bila mendekati batas
    const over = function (gs, dec) { const v = cnt(gs); if (v > maxVert || v * 14 > maxChars) return true; if (v * 20 < maxChars * 0.9) return false; return JSON.stringify(out(gs, dec)).length > maxChars; };
    let dec = 6, note = '', tol = 0, hilang = 0;
    if (over(cur, 6)) { dec = 5; note = 'dibulatkan ke ~1 m'; }
    if (dec === 5 && over(cur, 5)) {
      const n0 = cnt(cur); tol = n0 > maxVert * 4 ? 0.00003 : 0.00001; // data sangat padat: mulai dari toleransi lebih besar (≈3 m)
      while (over(cur, 5) && tol < 0.05) {
        cur = cur.map(function (grp) { return { kat: grp.kat, polys: grp.polys.map(function (rings) {
          const o = dp(rings[0], tol); if (o.length < 4) { hilang++; return null; }
          const holes = []; for (let i = 1; i < rings.length; i++) { const h = dp(rings[i], tol); if (h.length >= 4) holes.push(h); }
          return [o].concat(holes); }).filter(Boolean) }; }).filter(function (grp) { return grp.polys.length; });
        if (!cur.length) throw new Error('Semua poligon lebih kecil dari toleransi penyederhanaan. Periksa satuan koordinat.');
        tol *= 1.5; note = 'disederhanakan';
      }
      if (over(cur, 5)) throw new Error('Poligon terlalu kompleks untuk disimpan (' + cnt(cur) + ' titik). Potong atau sederhanakan di aplikasi GIS lalu impor ulang.');
      if (hilang) note += ' (' + hilang + ' poligon sangat kecil dibuang)';
    }
    const g = out(cur, dec);
    return { geom: g, note: note, luas: areaHa(g), vert: countVert(g), kats: bernama ? cur.map(function (x) { return x.kat || 'Lainnya'; }) : [] };
  }
  /** Shapefile (.zip, atau gabungan .shp/.prj/.dbf) → GeoJSON FeatureCollection. Pustaka shpjs dimuat saat dibutuhkan (self-hosted). */
  let shpLoad = null;
  function loadShp() {
    if (window.shp) return Promise.resolve(window.shp);
    return shpLoad || (shpLoad = new Promise(function (res, rej) { const sc = document.createElement('script'); sc.src = 'vendor/shp/shp.min.js'; sc.onload = function () { window.shp ? res(window.shp) : rej(new Error('Pustaka Shapefile gagal dimuat.')); }; sc.onerror = function () { shpLoad = null; rej(new Error('Pustaka Shapefile gagal dimuat. Periksa koneksi lalu coba lagi.')); }; document.head.appendChild(sc); }));
  }
  function readBuf(f) { return new Promise(function (res, rej) { const r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error('Berkas tidak dapat dibaca.')); }; r.readAsArrayBuffer(f); }); }
  function ext(f) { return (f.name.split('.').pop() || '').toLowerCase(); }
  function readShapefile(files) {
    files = Array.prototype.slice.call(files); const zip = files.filter(function (f) { return ext(f) === 'zip'; })[0]; const shpf = files.filter(function (f) { return ext(f) === 'shp'; })[0]; const prjf = files.filter(function (f) { return ext(f) === 'prj'; })[0];
    if (!zip && !shpf) return Promise.reject(new Error('Pilih berkas .zip Shapefile, atau berkas .shp (sertakan .prj dan .dbf).'));
    if (files.some(function (f) { return f.size > 300 * 1024 * 1024; })) return Promise.reject(new Error('Berkas terlalu besar (maks. 300 MB). Potong per kawasan di aplikasi GIS lalu impor ulang.'));
    return loadShp().then(function (shp) {
      if (zip) return readBuf(zip).then(function (b) { return shp(b); });
      const dbff = files.filter(function (f) { return ext(f) === 'dbf'; })[0];
      return Promise.all([readBuf(shpf), prjf ? prjf.text() : Promise.resolve(null), dbff ? readBuf(dbff) : Promise.resolve(null)]).then(function (r) {
        const geoms = shp.parseShp(r[0], r[1] || undefined); const attrs = r[2] ? shp.parseDbf(r[2]) : null;
        return { type: 'FeatureCollection', features: geoms.map(function (g, i) { return { type: 'Feature', properties: (attrs && attrs[i]) || {}, geometry: g }; }) };
      });
    }).then(function (g) {
      const cols = Array.isArray(g) ? g : [g]; const feats = []; cols.forEach(function (c) { (c.features || []).forEach(function (f) { feats.push(f); }); });
      const polys = polysOf({ type: 'FeatureCollection', features: feats });
      if (!polys.length) throw new Error('Shapefile ini tidak berisi poligon (mungkin titik/garis). Gunakan layer Polygon.');
      const sample = polys[0][0][0]; if (!sample || Math.abs(sample[0]) > 180 || Math.abs(sample[1]) > 90) throw new Error('Koordinat Shapefile bukan derajat (kemungkinan UTM) dan tidak dapat dikonversi. Sertakan berkas .prj dalam ZIP, atau ekspor ulang dengan CRS WGS 84 (EPSG:4326).');
      return { type: 'FeatureCollection', features: feats, _n: polys.length };
    });
  }
  function withKat(fc, col) { return { type: 'FeatureCollection', features: fc.features.map(function (f) { const v = col && f.properties ? f.properties[col] : null; return { type: 'Feature', properties: col ? { kategori: String(v == null || v === '' ? 'Lainnya' : v).slice(0, 60) } : {}, geometry: f.geometry }; }) }; }
  /** KML / KMZ → GeoJSON FeatureCollection (Polygon, MultiPolygon, Point, LineString). KMZ dibaca dengan DecompressionStream bawaan browser. */
  function kmlCoords(txt) {
    return String(txt || '').trim().split(/\s+/).map(function (t) { const a = t.split(',').map(Number); return a.length >= 2 && isFinite(a[0]) && isFinite(a[1]) ? [a[0], a[1]] : null; }).filter(Boolean);
  }
  function kmlRing(el) { const c = el && el.getElementsByTagName('coordinates')[0]; const r = kmlCoords(c && c.textContent); if (r.length < 3) return null; const f = r[0], l = r[r.length - 1]; if (f[0] !== l[0] || f[1] !== l[1]) r.push(f.slice()); return r; }
  function kmlGeoms(pm) {
    const out = [];
    Array.prototype.forEach.call(pm.getElementsByTagName('Polygon'), function (pg) {
      const ob = pg.getElementsByTagName('outerBoundaryIs')[0]; const o = kmlRing(ob); if (!o) return;
      const rings = [o]; Array.prototype.forEach.call(pg.getElementsByTagName('innerBoundaryIs'), function (ib) { const r = kmlRing(ib); if (r) rings.push(r); });
      out.push({ type: 'Polygon', coordinates: rings });
    });
    Array.prototype.forEach.call(pm.getElementsByTagName('LineString'), function (ls) { const c = kmlCoords((ls.getElementsByTagName('coordinates')[0] || {}).textContent); if (c.length > 1) out.push({ type: 'LineString', coordinates: c }); });
    Array.prototype.forEach.call(pm.getElementsByTagName('Point'), function (pt) { const c = kmlCoords((pt.getElementsByTagName('coordinates')[0] || {}).textContent); if (c.length) out.push({ type: 'Point', coordinates: c[0] }); });
    return out;
  }
  function parseKml(text) {
    const doc = new DOMParser().parseFromString(String(text || '').replace(/^﻿/, ''), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Berkas KML tidak valid (XML rusak).');
    const feats = [];
    Array.prototype.forEach.call(doc.getElementsByTagName('Placemark'), function (pm) {
      const pr = {}; const nm = pm.getElementsByTagName('name')[0]; if (nm && nm.parentNode === pm) pr.name = nm.textContent.trim().slice(0, 120);
      const ds = pm.getElementsByTagName('description')[0]; if (ds && ds.parentNode === pm) { const t = ds.textContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (t) pr.description = t.slice(0, 160); }
      let up = pm.parentNode; while (up && up.nodeType === 1) { if (up.localName === 'Folder' || up.localName === 'Document') { const fn = Array.prototype.filter.call(up.children, function (c) { return c.localName === 'name'; })[0]; if (fn && fn.textContent.trim()) { pr.folder = fn.textContent.trim().slice(0, 80); break; } } up = up.parentNode; }
      Array.prototype.forEach.call(pm.getElementsByTagName('Data'), function (d) { const k = d.getAttribute('name'); const v = d.getElementsByTagName('value')[0]; if (k) pr[k] = v ? v.textContent.trim() : ''; });
      Array.prototype.forEach.call(pm.getElementsByTagName('SimpleData'), function (d) { const k = d.getAttribute('name'); if (k) pr[k] = d.textContent.trim(); });
      kmlGeoms(pm).forEach(function (g) { feats.push({ type: 'Feature', properties: pr, geometry: g }); });
    });
    if (!feats.length) throw new Error('KML ini tidak berisi objek geometri (Placemark).');
    const poly = feats.filter(function (f) { return /Polygon/.test(f.geometry.type); });
    if (!poly.length) throw new Error('KML ini tidak berisi poligon (hanya titik/garis). Gunakan objek Polygon.');
    return { type: 'FeatureCollection', features: poly };
  }
  function unzipFirst(buf, pick) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf); let eo = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65600); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; } }
    if (eo < 0) throw new Error('KMZ tidak valid (bukan arsip ZIP).');
    let n = dv.getUint16(eo + 10, true), off = dv.getUint32(eo + 16, true), best = null;
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const meth = dv.getUint16(off + 10, true), csz = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true);
      const nm = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nl));
      if (pick.test(nm) && (!best || /(^|\/)doc\.kml$/i.test(nm))) best = { meth: meth, csz: csz, lo: lo, nm: nm };
      off += 46 + nl + el + cl;
    }
    if (!best) throw new Error('KMZ tidak berisi berkas .kml.');
    const ln = dv.getUint16(best.lo + 26, true), le = dv.getUint16(best.lo + 28, true), st = best.lo + 30 + ln + le; const data = u8.subarray(st, st + best.csz);
    if (best.meth === 0) return Promise.resolve(new TextDecoder().decode(data));
    if (best.meth !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Browser ini belum mendukung membuka KMZ. Ekspor ulang sebagai .kml, atau perbarui browser.'));
    return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  }
  function readKml(f) {
    if (f.size > 40 * 1024 * 1024) return Promise.reject(new Error('Berkas KML/KMZ terlalu besar (maks. 40 MB).'));
    const p = ext(f) === 'kmz' ? readBuf(f).then(function (b) { return unzipFirst(b, /\.kml$/i); }) : f.text();
    return p.then(parseKml);
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
    const ATTR_ESRI = 'Tiles &copy; Esri, HERE, Garmin, OpenStreetMap contributors';
    const jalan = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: ATTR_ESRI });
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; kontributor <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' });
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Citra &copy; Esri, Maxar, Earthstar Geographics' });
    (opts.satelit ? sat : jalan).addTo(map);
    let nerr = 0; jalan.on('tileerror', function () { // Esri gagal → pindah otomatis ke OSM
      if (++nerr === 4 && map.hasLayer(jalan)) { map.removeLayer(jalan); osm.addTo(map); }
    });
    L.control.layers({ 'Peta jalan (Esri)': jalan, 'OpenStreetMap': osm, 'Citra satelit': sat }, opts.arcgis === false ? null : arcOverlays(map), { collapsed: true }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    (opts.modal ? liveModal : live).push(map); setTimeout(function () { try { if (map._mapPane) map.invalidateSize(); } catch (e) {} }, 80);
    return map;
  }
  function disposeAll() { while (live.length) { const m = live.pop(); try { m.remove(); } catch (e) {} } }
  function disposeModal() { while (liveModal.length) { const m = liveModal.pop(); try { m.remove(); } catch (e) {} } }

  function styleBatas() { return { color: '#0a6f73', weight: 2, dashArray: '6 4', fillColor: '#0e8f94', fillOpacity: 0.08 }; }
  function warnaArea(a) { return a.status === 'Draft' ? WARNA.Draft : (WARNA[groupOf(a)] || '#0e8f94'); }


  /* ------------------------------ kategori area (warna berbeda per kategori) ------------------------------ */
  const KAT_TETAP = [[/penangkapan|tangkap/i, '#F9A825'], [/budidaya/i, '#8E24AA'], [/wisata/i, '#1E88E5'], [/rehabilitasi|pemulihan/i, '#00897B'], [/inti|larang|sanctuary/i, '#C62828'], [/rimba|perlindungan bahari|perlindungan/i, '#2E7D32'], [/pemanfaatan/i, '#1E6FD9'], [/tradisional|adat/i, '#EF8A17'], [/khusus|religi|budaya/i, '#6A1B9A'], [/penyangga|buffer/i, '#8D6E63'], [/lainnya|lain/i, '#78909C']];
  const KAT_PALET = ['#E91E63', '#009688', '#FF9800', '#3F51B5', '#8BC34A', '#795548', '#00ACC1', '#AFB42B', '#D84315', '#5E35B1', '#43A047', '#F4511E'];
  function kustom() { return (typeof S !== 'undefined' && S.master && S.master.config && S.master.config.warna_kategori) || {}; }
  function katWarnaDasar(k) { const c = kustom(); const sv = c[String(k).trim().toLowerCase()]; if (sv) { delete c[String(k).trim().toLowerCase()]; const r = katWarna(k); c[String(k).trim().toLowerCase()] = sv; return r; } return katWarna(k); }
  function katWarna(k) {
    k = String(k || ''); if (!k) return '#0e8f94'; const cu = kustom(); const ck = cu[k.trim().toLowerCase()]; if (ck && /^#[0-9a-f]{6}$/i.test(ck)) return ck; for (let i = 0; i < KAT_TETAP.length; i++) if (KAT_TETAP[i][0].test(k)) return KAT_TETAP[i][1];
    let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return KAT_PALET[h % KAT_PALET.length];
  }
  /** [{kat, polys}] — kat dari Feature.properties.kategori ('' bila tidak ada). */
  function groupsOf(g, kat, out) {
    out = out || []; if (!g || typeof g !== 'object') return out;
    if (g.type === 'FeatureCollection') (g.features || []).forEach(function (f) { groupsOf(f, '', out); });
    else if (g.type === 'Feature') groupsOf(g.geometry, String((g.properties && g.properties.kategori) || '').slice(0, 60), out);
    else if (g.type === 'Polygon' || g.type === 'MultiPolygon') { let x = out.filter(function (o) { return o.kat === (kat || ''); })[0]; if (!x) { x = { kat: kat || '', polys: [] }; out.push(x); } if (g.type === 'Polygon') x.polys.push(g.coordinates); else (g.coordinates || []).forEach(function (c) { x.polys.push(c); }); }
    return out;
  }
  function katsOf(g) { return groupsOf(g).filter(function (x) { return x.kat; }).map(function (x) { return x.kat; }); }
  /** Gambar geometri ke peta; bila ada kategori, tiap kategori berwarna sendiri (tooltip: nama + luas). Mengembalikan featureGroup. */
  function addGeo(g, base, label, map) {
    const fg = L.featureGroup(); const gr = groupsOf(g); const big = map && countVert(g) > 15000; const rend = big ? (map._cv = map._cv || L.canvas({ padding: 0.3 })) : null;
    if (gr.some(function (x) { return x.kat; })) {
      gr.forEach(function (x) { const c = katWarna(x.kat); const geom = x.polys.length === 1 ? { type: 'Polygon', coordinates: x.polys[0] } : { type: 'MultiPolygon', coordinates: x.polys };
        L.polygon(latlngs(geom), { color: c, weight: big ? 1 : 2, fillColor: c, fillOpacity: 0.38, smoothFactor: big ? 1.5 : 1, renderer: rend || undefined }).bindTooltip((label ? esc(label) + ' · ' : '') + '<b>' + esc(x.kat || 'Lainnya') + '</b>', { sticky: true }).addTo(fg); });
    } else L.polygon(latlngs(g), base).addTo(fg);
    return fg;
  }
  function numHa(n) { return Number(n || 0).toLocaleString('id-ID'); }
  function setLegend(map, kats, judul, key) {
    key = key || 'main'; map._lg = map._lg || {}; if (map._lg[key]) { try { map.removeControl(map._lg[key]); } catch (e) {} map._lg[key] = null; }
    const u = []; (kats || []).forEach(function (k) { if (k && u.indexOf(k) < 0) u.push(k); }); if (!u.length) return;
    const c = L.control({ position: 'bottomleft' }); c.onAdd = function () { const d = L.DomUtil.create('div', 'legend'); d.innerHTML = '<b>' + esc(judul || 'Kategori area') + '</b>' + u.map(function (k) { return '<div><i style="background:' + katWarna(k) + '"></i>' + esc(k) + '</div>'; }).join(''); L.DomEvent.disableClickPropagation(d); return d; };
    c.addTo(map); map._lg[key] = c;
  }

  /* ------------------------------ ArcGIS Online ------------------------------ */
  const ARC_OK = /^https:\/\/([a-z0-9-]+\.)+(arcgis\.com|arcgisonline\.com)\/.+/i;
  function arcLayerUrl(u) { u = String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, ''); if (/\/(FeatureServer|MapServer)$/i.test(u)) u += '/0'; return u; }
  /** Ambil fitur dari layer ArcGIS (FeatureServer/MapServer, layer publik) sebagai GeoJSON WGS84. Pagination hingga 5×1000 fitur. */
  function fetchArcgis(url, maxPages) {
    url = arcLayerUrl(url); if (!ARC_OK.test(url)) return Promise.reject(new Error('URL harus https dan dari ArcGIS Online (*.arcgis.com / *.arcgisonline.com).'));
    const feats = []; let off = 0, page = 0;
    const next = function () {
      const q = url + '/query?where=1%3D1&outFields=*&outSR=4326&returnGeometry=true&f=geojson&resultRecordCount=1000&resultOffset=' + off;
      return fetch(q, { mode: 'cors', credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error('ArcGIS menolak permintaan (HTTP ' + r.status + ').'); return r.json(); }).then(function (j) {
        if (j && j.error) throw new Error('ArcGIS: ' + (j.error.message || 'layer tidak dapat diakses') + (j.error.code === 499 || j.error.code === 498 ? ' — layer ini privat; ubah berbagi menjadi Publik.' : ''));
        if (!j || !Array.isArray(j.features)) throw new Error('Respons ArcGIS tidak dikenali. Pastikan ini URL layer fitur (…/FeatureServer/0).');
        j.features.forEach(function (f) { feats.push(f); }); off += j.features.length; page++;
        const more = (j.exceededTransferLimit || (j.properties && j.properties.exceededTransferLimit)) && j.features.length && page < (maxPages || 5); return more ? next() : { type: 'FeatureCollection', features: feats };
      });
    };
    return next().catch(function (e) { if (e instanceof TypeError) throw new Error('Tidak dapat menghubungi ArcGIS (jaringan/CORS). Pastikan layer berbagi Publik dan URL benar.'); throw e; });
  }
  function arcOverlays(map) { // layer ArcGIS yang didaftarkan Admin → opsi di kontrol lapisan, dimuat saat dicentang
    const list = ((typeof S !== 'undefined' && S.master && S.master.config && S.master.config.arcgis_layers) || []).filter(function (l) { return l && ARC_OK.test(l.url || ''); }); const ov = {};
    list.forEach(function (l) {
      let lay;
      if (l.jenis === 'tile') { lay = L.tileLayer(l.url.replace(/\/+$/, '') + '/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.8, attribution: 'ArcGIS Online' }); }
      else {
        lay = L.featureGroup(); let loaded = false, loading = false;
        lay.on('add', function () {
          if (loaded || loading) return; loading = true; toast('', 'Memuat layer ArcGIS “' + l.nama + '”…');
          fetchArcgis(l.url, 5).then(function (fc) {
            loaded = true; const kolom = l.kolom; const kats = [];
            L.geoJSON(fc, { style: function (f) { const k = kolom && f.properties ? String(f.properties[kolom] == null ? '' : f.properties[kolom]) : ''; const c = k ? katWarna(k) : '#6A5ACD'; if (k && kats.indexOf(k) < 0) kats.push(k); return { color: c, weight: 2, fillColor: c, fillOpacity: 0.3 }; },
              onEachFeature: function (f, ly) { const pr = f.properties || {}; ly.bindPopup('<div class="pop"><b>' + esc(l.nama) + '</b><br>' + Object.keys(pr).slice(0, 8).map(function (k) { return esc(k) + ': ' + esc(pr[k]); }).join('<br>') + '</div>'); } }).addTo(lay);
            lay._kats = kats; if (kats.length) setLegend(map, kats, l.nama, 'arc:' + l.nama);
          }).catch(function (e) { loading = false; toast('bad', e.message); }); });
      }
      lay.on('remove', function () { setLegend(map, [], '', 'arc:' + l.nama); });
      lay.on('add', function () { if (lay._kats) setLegend(map, lay._kats, l.nama, 'arc:' + l.nama); });
      ov['ArcGIS: ' + l.nama] = lay;
    });
    return ov;
  }

  /** Peta ikhtisar: batas kawasan + area pengajuan. */
  function overview(el, o) {
    const map = create(el, { scroll: o.scroll, satelit: o.satelit }); if (!map) return null;
    const gB = L.featureGroup().addTo(map), gA = L.featureGroup().addTo(map);
    function draw(batas, areas) {
      gB.clearLayers(); gA.clearLayers();
      let katsA = []; const kts = []; (batas || []).forEach(function (b) { const g = parse(b.geojson); if (!g) return; const ks = katsOf(g); if (ks.length) { ks.forEach(function (k) { kts.push(k); }); addGeo(g, null, b.kawasan, map).addTo(gB); L.polygon(latlngs(g), { color: '#0a6f73', weight: 2, dashArray: '6 4', fill: false, interactive: false }).addTo(gB); } else L.polygon(latlngs(g), styleBatas()).bindTooltip(esc(b.kawasan) + (b.luas_ha ? ' · ' + Number(b.luas_ha).toLocaleString('id-ID') + ' Ha' : ''), { sticky: true }).addTo(gB); }); setLegend(map, kts, 'Zona / kategori');
      (areas || []).forEach(function (a) {
        const g = parse(a.geojson); if (!g) return; const c = warnaArea(a);
        const ka = katsOf(g); katsA = katsA.concat(ka); const poly = (ka.length ? addGeo(g, null, a.nama) : L.polygon(latlngs(g), { color: c, weight: 2, fillColor: c, fillOpacity: 0.35 })).addTo(gA);
        poly.bindPopup('<div class="pop"><b>' + esc(a.judul) + '</b><br>' + esc(a.nomor) + ' · ' + esc(a.lembaga) + '<br>' + esc(a.nama) + ' · ' + Number(a.luas_ha || 0).toLocaleString('id-ID') + ' Ha<br><span class="chip ' + statusClass(a) + '">' + esc(a.status) + '</span><br><button class="btn btn-p btn-s" data-pop-open="' + esc(a.id_pengajuan) + '" style="margin-top:6px">Buka pengajuan</button></div>');
      });
      if (katsA.length) setLegend(map, kts.concat(katsA), 'Zona / kategori');
      const all = L.featureGroup([gB, gA]); const bb = (o.fitAreas && gA.getLayers().length) ? gA.getBounds() : ((gB.getLayers().length || gA.getLayers().length) ? all.getBounds() : null); if (bb && bb.isValid()) map.fitBounds(bb.pad(o.fitAreas ? 0.3 : 0.15), { maxZoom: o.fitAreas ? 16 : 13 });
    }
    map.on('popupopen', function (e) { const b = e.popup.getElement().querySelector('[data-pop-open]'); if (b) b.onclick = function () { map.closePopup(); if (o.onOpen) o.onOpen(b.dataset.popOpen); }; });
    if (o.onClick) map.on('click', function (e) { o.onClick(e.latlng.lat, e.latlng.lng); });
    draw(o.batas, o.areas);
    return { map: map, update: draw };
  }

  /* ------------------------------ editor poligon ------------------------------ */
  /** Widget editor lengkap di dalam host. opts: {geom, kawasan, batas, onChange(geom|null, luas), maxChars, satelit, readonly} */
  function editor(host, opts) {
    opts = opts || {}; const maxChars = opts.maxChars || 40000, maxVert = opts.maxVert || MAX_VERT;
    host.innerHTML = (opts.readonly ? '' : (opts.shpOnly ? '<div class="mapbar"><button type="button" class="btn btn-p btn-s" data-m="import">' + mi('upload_file') + ' Unggah Shapefile / KML</button><button type="button" class="btn btn-o btn-s" data-m="clear">' + mi('delete') + ' Hapus</button></div>' : '<div class="mapbar"><button type="button" class="btn btn-p btn-s" data-m="draw">' + mi('draw') + ' Gambar area</button><button type="button" class="btn btn-o btn-s" data-m="undo">' + mi('undo') + ' Urungkan</button><button type="button" class="btn btn-o btn-s" data-m="clear">' + mi('delete') + ' Hapus</button><button type="button" class="btn btn-o btn-s" data-m="import">' + mi('edit_location') + ' Isi koordinat / Impor</button><button type="button" class="btn btn-o btn-s" data-m="locate">' + mi('my_location') + ' Lokasi saya</button></div>')) +
      '<div class="mapbox"></div><div class="mapinfo" aria-live="polite"></div><div class="mapcheck"></div>';
    const box = host.querySelector('.mapbox'), info = host.querySelector('.mapinfo'), chk = host.querySelector('.mapcheck');
    const map = create(box, { satelit: opts.satelit, modal: opts.modal }); if (!map) return null;
    const gBatas = L.featureGroup().addTo(map);
    function setBatas(list) { gBatas.clearLayers(); opts.batas = list || []; const kts = []; opts.batas.forEach(function (b) { const g = parse(b.geojson); if (!g) return; const ks = katsOf(g); if (ks.length) { ks.forEach(function (k) { kts.push(k); }); addGeo(g, null, b.kawasan, map).addTo(gBatas); } else L.polygon(latlngs(g), styleBatas()).bindTooltip(esc(b.kawasan), { sticky: true }).addTo(gBatas); }); setLegend(map, kts, 'Zona / kategori'); summary(); }
    let pts = [], complex = null, drawing = false, poly = null, markers = [];
    const COL = '#F26B4F';
    const g0 = parse(opts.geom);
    if (g0) { const ps = polysOf(g0); if (!katsOf(g0).length && ps.length === 1 && ps[0].length === 1) pts = ps[0][0].slice(0, -1).map(function (p) { return [p[1], p[0]]; }); else complex = g0; }
    function current() { if (complex) return complex; if (pts.length < 3) return null; const ring = pts.map(function (p) { return [p[1], p[0]]; }); ring.push(ring[0].slice()); return { type: 'Polygon', coordinates: [ring] }; }
    function render(fit) {
      if (poly) { map.removeLayer(poly); poly = null; } markers.forEach(function (m) { map.removeLayer(m); }); markers = [];
      if (complex) { poly = addGeo(complex, { color: COL, weight: 2, fillOpacity: 0.3 }, '', map).addTo(map); const ks = katsOf(complex); setLegend(map, ks, 'Kategori area'); if (fit) map.fitBounds(poly.getBounds().pad(0.2)); }
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
      pn.innerHTML = '<p class="sub" style="margin-bottom:8px">Tempel <b>GeoJSON</b> (Polygon / MultiPolygon / Feature / FeatureCollection, koordinat [bujur, lintang]) <b>atau</b> daftar titik, satu per baris: <code>lintang,bujur</code>. Atau pilih berkas <b>KML / KMZ</b>, <b>Shapefile</b> (.zip, atau .shp + .prj + .dbf sekaligus), .geojson, atau .json.</p>' +
        '<textarea class="in" data-imp="txt" rows="6" placeholder="-0.8917,119.8707&#10;-0.8920,119.8750&#10;-0.8950,119.8730"></textarea><input type="file" data-imp="file" multiple accept=".zip,.shp,.dbf,.prj,.cpg,.shx,.kml,.kmz,.geojson,.json,.txt,application/json,application/zip" style="margin-top:8px"><div class="hint" data-imp="info" style="margin-top:6px"></div><div class="fld" data-imp="katbox" style="display:none;margin-top:8px"><label>Kolom kategori (tiap kategori diberi warna berbeda)</label><select class="in" data-imp="kol"></select></div><div class="fld" style="margin-top:8px"><label>Atau ambil dari ArcGIS Online (URL layer fitur publik)</label><div style="display:flex;gap:6px"><input class="in" data-imp="arc" placeholder="https://services.arcgis.com/…/FeatureServer/0"><button type="button" class="btn btn-o btn-s" data-imp="arcgo">Ambil</button></div></div>' +
        '<div class="errtxt" data-imp="err" role="alert"></div><div class="btns" style="margin-top:8px"><button type="button" class="btn btn-o btn-s" data-imp="cancel">Batal</button><button type="button" class="btn btn-p btn-s" data-imp="ok">Gunakan</button></div>';
      host.insertBefore(pn, box.parentNode === host ? box : null); const q = function (k) { return pn.querySelector('[data-imp="' + k + '"]'); };
      if (opts.shpOnly) { pn.querySelector('p.sub').innerHTML = 'Unggah <b>Shapefile</b> atau <b>KML/KMZ</b> area kegiatan Anda. Untuk Shapefile: satu berkas <b>.zip</b> berisi .shp, .shx, .dbf, dan .prj (disarankan), atau pilih berkas <b>.shp + .dbf + .prj</b> sekaligus. Format yang diterima: Shapefile atau <b>KML / KMZ</b> (Google Earth).'; q('txt').style.display = 'none'; q('arc').closest('.fld').style.display = 'none'; q('file').accept = '.zip,.shp,.shx,.dbf,.prj,.cpg,.kml,.kmz'; q('file').style.marginTop = '0'; }
      q('cancel').onclick = function () { pn.remove(); };
      let pend = null; // {fc, cols} dari Shapefile / ArcGIS; kategori dipilih lewat kolom
      const AUTO = /^(kategori|zona|zonasi|fungsi|klas|kelas|jenis|tipe|type|nama_zona|zone|folder|nama|name|status|kode)/i;
      const kolInfo = function () {
        const col = q('kol').value; const info = q('info'); const n = pend ? pend._n : 0;
        if (!col) { info.innerHTML = '&#10003; Terbaca: <b>' + n + '</b> poligon (tanpa kategori). Klik <b>Gunakan</b>.'; return; }
        const set = {}; pend.fc.features.forEach(function (f) { set[String((f.properties || {})[col] == null ? '' : f.properties[col])] = 1; });
        info.innerHTML = '&#10003; Terbaca: <b>' + n + '</b> poligon, <b>' + Object.keys(set).length + '</b> kategori dari kolom <b>' + esc(col) + '</b>: ' + Object.keys(set).slice(0, 8).map(function (k) { return '<span class="lg"><i style="background:' + katWarna(k) + '"></i>' + esc(k || 'Lainnya') + '</span>'; }).join(' ') + (Object.keys(set).length > 8 ? ' …' : '');
      };
      const setPending = function (fc) {
        const polys = polysOf(fc); if (!polys.length) throw new Error('Data tidak berisi poligon (mungkin titik/garis). Gunakan layer Polygon.');
        const sample = polys[0][0][0]; if (!sample || Math.abs(sample[0]) > 180 || Math.abs(sample[1]) > 90) throw new Error('Koordinat bukan derajat (kemungkinan UTM) dan tidak dapat dikonversi. Sertakan berkas .prj dalam ZIP, atau ekspor ulang dengan CRS WGS 84 (EPSG:4326).');
        const keys = []; fc.features.forEach(function (f) { Object.keys(f.properties || {}).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
        const usable = keys.filter(function (k) { const set = {}; fc.features.forEach(function (f) { set[String((f.properties || {})[k])] = 1; }); const c = Object.keys(set).length; return c >= 1 && c <= 40 && fc.features.some(function (f) { return f.properties && f.properties[k] != null && f.properties[k] !== ''; }); });
        pend = { fc: fc, _n: polys.length }; const sel = q('kol'); sel.innerHTML = '<option value="">— Tanpa kategori (satu warna) —</option>' + usable.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join('');
        const auto = usable.filter(function (k) { return AUTO.test(k); }).sort(function (a, b) { const ia = AUTO.exec(a)[1].toLowerCase(), ib = AUTO.exec(b)[1].toLowerCase(); return 0; })[0];
        const multi = function (k) { const set = {}; fc.features.forEach(function (f) { set[String((f.properties || {})[k])] = 1; }); return Object.keys(set).length > 1; };
        const fol = usable.filter(function (k) { return k === 'folder' && multi(k); })[0];
        sel.value = fol || ((auto && multi(auto)) ? auto : (usable.filter(multi)[0] || '')); if (fc.features.length < 2 && !sel.value) sel.value = '';
        q('katbox').style.display = usable.length ? '' : 'none'; q('txt').value = ''; kolInfo();
      };
      q('kol').onchange = kolInfo; q('txt').addEventListener('input', function () { pend = null; q('katbox').style.display = 'none'; });
      q('file').onchange = function () {
        const fs = Array.prototype.slice.call(this.files); if (!fs.length) return; q('err').textContent = ''; q('info').textContent = ''; pend = null; q('katbox').style.display = 'none';
        if (fs.some(function (f) { return ['zip', 'shp'].indexOf(ext(f)) > -1; })) {
          q('info').textContent = 'Membaca Shapefile (' + (fs.reduce(function (a, f) { return a + f.size; }, 0) / 1048576).toFixed(1) + ' MB)… berkas besar bisa memakan beberapa detik.';
          readShapefile(fs).then(function (g) { setPending({ type: 'FeatureCollection', features: g.features }); }).catch(function (e) { q('info').textContent = ''; q('err').textContent = e.message || 'Shapefile tidak dapat dibaca.'; });
          return;
        }
        if (fs.some(function (f) { return ['kml', 'kmz'].indexOf(ext(f)) > -1; })) {
          q('info').textContent = 'Membaca KML…'; const kf = fs.filter(function (f) { return ['kml', 'kmz'].indexOf(ext(f)) > -1; })[0];
          readKml(kf).then(function (fc) { setPending(fc); }).catch(function (e) { q('info').textContent = ''; q('err').textContent = e.message || 'KML tidak dapat dibaca.'; });
          return;
        }
        if (opts.shpOnly) { q('err').textContent = 'Hanya Shapefile (.zip/.shp) atau KML/KMZ yang diterima.'; this.value = ''; return; }
        const f = fs[0]; if (f.size > 3 * 1024 * 1024) { q('err').textContent = 'Berkas terlalu besar (maks. 3 MB).'; return; } const r = new FileReader(); r.onload = function () { q('txt').value = r.result; }; r.readAsText(f);
      };
      q('arcgo').onclick = function () {
        q('err').textContent = ''; q('info').textContent = 'Mengambil data dari ArcGIS Online…'; pend = null; q('katbox').style.display = 'none';
        fetchArcgis(q('arc').value, 5).then(function (fc) { if (!fc.features.length) throw new Error('Layer tidak berisi fitur.'); setPending(fc); }).catch(function (e) { q('info').textContent = ''; q('err').textContent = e.message; });
      };
      q('ok').onclick = function () {
        const btn = q('ok'); if (opts.shpOnly && !pend) { q('err').textContent = 'Pilih berkas Shapefile atau KML/KMZ terlebih dahulu.'; return; } const work = function () {
          let g; try { g = normalize(pend ? withKat(pend.fc, q('kol').value) : parseText(q('txt').value), maxChars, maxVert); } catch (e) { q('err').textContent = e.message; q('info').textContent = ''; btn.disabled = false; return; }
        complex = null; const ps = polysOf(g.geom); if (!g.kats.length && ps.length === 1 && ps[0].length === 1) { pts = ps[0][0].slice(0, -1).map(function (p) { return [p[1], p[0]]; }); } else { pts = []; complex = g.geom; }
        setDrawing(false); render(true); changed(); if (g.note) toast('', 'Poligon ' + g.note + ' agar muat (' + g.vert + ' titik).'); if (g.kats.length) toast('ok', g.kats.length + ' kategori diberi warna berbeda.'); pn.remove();
        };
        q('err').textContent = ''; if (pend && pend._n > 200) { btn.disabled = true; q('info').textContent = 'Memproses ' + pend._n + ' poligon…'; setTimeout(work, 40); } else work();
      };
      q('txt').focus();
    }
    if (host._mkClick) host.removeEventListener('click', host._mkClick); // cegah pemasangan ganda pada elemen yang sama
    host._mkClick = function (e) {
      const b = e.target.closest('[data-m]'); if (!b) return; const a = b.dataset.m;
      if (a === 'draw') { if (complex) { toast('bad', 'Area hasil impor tidak dapat digambar ulang. Hapus dulu atau impor ulang.'); return; } setDrawing(!drawing); }
      else if (a === 'undo') { pts.pop(); render(); changed(); }
      else if (a === 'clear') { pts = []; complex = null; setDrawing(false); render(); changed(); }
      else if (a === 'import') doImport();
      else if (a === 'locate') { map.locate({ setView: true, maxZoom: 16 }); }
    };
    host.addEventListener('click', host._mkClick);
    map.on('locationerror', function () { toast('bad', 'Lokasi tidak tersedia. Izinkan akses lokasi pada browser.'); });
    setBatas(opts.batas); render(true); if (!pts.length && !complex && opts.fokus) map.setView(opts.fokus, 10);
    else if (!pts.length && !complex && opts.batas && opts.kawasan) { const b = opts.batas.filter(function (x) { return x.kawasan === opts.kawasan && x.geojson; })[0]; if (b) map.fitBounds(boundsOf(parse(b.geojson)).pad(0.1)); }
    function fitBatas() { if (pts.length || complex || !opts.kawasan) return; const b = (opts.batas || []).filter(function (x) { return x.kawasan === opts.kawasan && x.geojson; })[0]; if (b) map.fitBounds(boundsOf(parse(b.geojson)).pad(0.1)); }
    return { map: map, setBatas: function (l) { setBatas(l); fitBatas(); }, geom: current, luas: function () { const g = current(); return g ? areaHa(g) : 0; }, refresh: summary, setKawasan: function (k) { opts.kawasan = k; summary(); }, invalidate: function () { map.invalidateSize(); } };
  }

  return { fetchArcgis: fetchArcgis, katWarna: katWarna, katWarnaDasar: katWarnaDasar, katsOf: katsOf, create: create, overview: overview, editor: editor, disposeAll: disposeAll, disposeModal: disposeModal, normalize: normalize, parseText: parseText, areaHa: areaHa, pointIn: pointIn, cek: cek, lokasiInfo: lokasiInfo, parse: parse, boundsOf: boundsOf, latlngs: latlngs, WARNA: WARNA };
})();
