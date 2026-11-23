/* =====================================================================
 * Halaman: Dashboard (v2), Berita Acara & PKS, Statistik, Peta, Verifikasi, Bantuan,
 *          tab Peta pada detail, modal area & batas kawasan
 * ===================================================================== */
'use strict';

S.dash = { periode: 'all', kawasan: '' };
S.peta = null; S.dok = null; S.dokTab = 'semua'; S.petaF = { kawasan: '', grup: '' };

const PHASES = [
  { t1: 1, t2: 3, nama: 'Permohonan & Verifikasi' }, { t1: 4, t2: 5, nama: 'Telaah Ruang & RPZ' }, { t1: 6, t2: 8, nama: 'Pemaparan & BA Sepakat' },
  { t1: 9, t2: 11, nama: 'Draft PKS & Tanda Tangan' }, { t1: 12, t2: 12, nama: 'Monev & Pelaksanaan' }
];
const CTA = { 1: 'Lengkapi', 2: 'Disposisi', 3: 'Verifikasi', 4: 'Telaah ruang', 5: 'Telaah program', 6: 'Pemaparan', 7: 'Penelaahan', 8: 'Kesepakatan', 9: 'Susun PKS', 10: 'Lapor ke DKP', 11: 'Tanda tangan', 12: 'Monev' };
const DONUT = ['#0B2A4A', '#2f7de1', '#39c5c9', '#0e8f94', '#9db6cf'];

/* ----------------------------- util ----------------------------- */
function inPeriode(iso, per) {
  if (per === 'all') return true; const d = new Date(iso), n = new Date();
  if (per === '30' || per === '90') return (n - d) / 864e5 <= +per; if (per === 'thn') return d.getFullYear() === n.getFullYear(); if (per === 'thnlalu') return d.getFullYear() === n.getFullYear() - 1; return true;
}
function rpBig(n) { n = Number(n); if (!isFinite(n) || !n) return 'Rp 0'; if (n >= 1e9) return 'Rp ' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' Miliar'; if (n >= 1e6) return 'Rp ' + Math.round(n / 1e6).toLocaleString('id-ID') + ' Jt'; return 'Rp ' + n.toLocaleString('id-ID'); }
function waitTxt(iso) { const d = Math.floor((Date.now() - new Date(iso)) / 864e5); return d < 1 ? 'hari ini' : d + ' hari'; }
function numID(n, dg) { return Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: dg === undefined ? 2 : dg }); }
function csvCell(v) { let s = String(v === undefined || v === null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function downloadCSV(name, rows) {
  const txt = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  const url = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}
function today() { return new Date().toISOString().slice(0, 10); }
function loadPeta(force) {
  if (!force && S.peta && Date.now() - S.peta.t < 120000) return Promise.resolve(S.peta);
  return api('peta').then(function (r) { S.peta = { areas: r.areas, batas: r.batas, t: Date.now() }; LS.set('sm_peta', S.peta); return S.peta; });
}
function dashData() {
  const f = S.dash; return S.daftar.filter(function (p) { return !p._pending && (!f.kawasan || p.kawasan === f.kawasan) && inPeriode(p.dibuat, f.periode); });
}
function gauge(pct) {
  const L = Math.PI * 80, v = Math.max(0, Math.min(100, pct));
  return '<svg viewBox="0 0 200 118" role="img" aria-label="Capaian ' + v.toFixed(1) + ' persen"><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--line)" stroke-width="16" stroke-linecap="round"/><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--teal)" stroke-width="16" stroke-linecap="round" stroke-dasharray="' + (v / 100 * L) + ' ' + L + '"/><text x="100" y="92" text-anchor="middle" font-size="30" font-weight="800" fill="currentColor">' + v.toFixed(1) + '%</text></svg>';
}
function donutSvg(parts, total) {
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const arcs = parts.map(function (p) { const len = total ? p.n / total * C : 0; const s = '<circle r="' + R + '" cx="65" cy="65" fill="none" stroke="' + p.c + '" stroke-width="16" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 65 65)"/>'; off += len; return s; }).join('');
  return '<svg viewBox="0 0 130 130" role="img" aria-label="Diagram sebaran">' + (total ? arcs : '<circle r="52" cx="65" cy="65" fill="none" stroke="var(--line)" stroke-width="16"/>') + '<text x="65" y="68" text-anchor="middle" font-size="22" font-weight="800" fill="currentColor">' + total + '</text><text x="65" y="82" text-anchor="middle" font-size="9" fill="var(--tx-3)">Mitra</text></svg>';
}

/* ----------------------------- Dashboard v2 ----------------------------- */
function vDashboard() {
  setTitle('Dashboard'); const D = dashData(); const ids = {}; D.forEach(function (p) { ids[p.id] = true; });
  const act = function (p) { return FINAL.indexOf(p.status) === -1; };
  const telaah = D.filter(function (p) { return act(p) && p.tahap >= 3 && p.tahap <= 7; });
  const revisi = D.filter(function (p) { return p.status === 'Perlu dilengkapi'; });
  const pks = D.filter(function (p) { return act(p) && p.tahap >= 9; });
  const mon = S.monev.filter(function (m) { return ids[m.id_pengajuan]; });
  const avg = mon.length ? mon.reduce(function (a, m) { return a + Number(m.capaian_persen || 0); }, 0) / mon.length : null;
  const now = new Date(), cm = now.getMonth(), cy = now.getFullYear();
  const cur = D.filter(function (p) { const d = new Date(p.dibuat); return d.getMonth() === cm && d.getFullYear() === cy; }).length;
  const prev = D.filter(function (p) { const d = new Date(p.dibuat); const pm = (cm + 11) % 12, py = cm === 0 ? cy - 1 : cy; return d.getMonth() === pm && d.getFullYear() === py; }).length;
  const trend = prev ? ((cur - prev) / prev * 100) : null;
  const trendTag = trend === null ? (cur ? '<span class="tag tg-up">' + cur + ' baru bulan ini</span>' : '') : '<span class="tag ' + (trend >= 0 ? 'tg-up' : 'tg-dn') + '">' + (trend >= 0 ? '▲ +' : '▼ ') + trend.toFixed(1) + '%</span><span>vs bulan lalu</span>';
  const kpi = function (lb, ic, bg, fg, val, unit, foot, go) { return '<button class="kpi2" data-act="goDaftar" data-p=\'' + esc(JSON.stringify(go)) + '\'><div class="lb"><span>' + lb + '</span><span class="ic" style="background:' + bg + ';color:' + fg + '">' + mi(ic) + '</span></div><div class="vl">' + val + (unit ? ' <small>' + unit + '</small>' : '') + '</div><div class="ft">' + foot + '</div></button>'; };
  const kpis = '<div class="kpis">' +
    kpi('Total pengajuan', 'description', 'var(--blue-l)', 'var(--blue)', D.length, 'Usulan', trendTag, {}) +
    kpi('Dalam telaah', 'fact_check', 'var(--bg)', 'var(--tx-2)', telaah.length, 'Dokumen', '<span class="tag tg-b">Tahap 3 – 7</span><span>Sedang ditelaah</span>', { t1: 3, t2: 7 }) +
    kpi('Revisi dokumen', 'edit_note', 'var(--coral-l)', 'var(--coral)', revisi.length, 'Dokumen', '<span class="tag tg-w">Perlu dilengkapi</span><span>oleh mitra</span>', { grup: 'Perlu dilengkapi' }) +
    kpi('PKS berjalan', 'handshake', 'var(--teal-l)', 'var(--teal-d)', pks.length, 'Kemitraan', '<span class="tag tg-t">Tahap 9 – 12</span><span>PKS disusun / aktif</span>', { t1: 9, t2: 12 }) +
    '<button class="kpi2" data-act="goDaftar" data-p=\'{"tahap":"12"}\'><div class="lb"><span>Realisasi monev</span><span class="ic" style="background:var(--green-l);color:var(--green-d)">' + mi('task_alt') + '</span></div><div class="vl">' + (avg === null ? '—' : avg.toFixed(1) + '%') + '</div><div class="ft"><span>Target RPB: 100%</span>' + (avg === null ? '' : '<span class="tag ' + (avg >= 80 ? 'tg-up' : 'tg-w') + '">' + (avg >= 80 ? 'On-Track' : 'Perlu dikejar') + '</span>') + '</div></button></div>';
  const phases = '<div class="phases">' + PHASES.map(function (ph, i) {
    const items = D.filter(function (p) { return act(p) && p.tahap >= ph.t1 && p.tahap <= ph.t2; }).sort(function (a, b) { return a.diubah < b.diubah ? 1 : -1; });
    return '<div class="ph-col"><button class="ph-head ph-' + i + '" data-act="goDaftar" data-p=\'' + esc(JSON.stringify({ t1: ph.t1, t2: ph.t2 })) + '\'><div class="r1"><span>TAHAP ' + (ph.t1 === ph.t2 ? ph.t1 : ph.t1 + ' – ' + ph.t2) + '</span><span>' + items.length + ' Usulan</span></div><b>' + esc(ph.nama) + '</b></button>' +
      items.slice(0, 3).map(function (p) { return '<button class="mini" data-act="open" data-id="' + esc(p.id) + '"><div class="t"><i>' + esc(initials(p.lembaga)) + '</i><span>' + esc(p.lembaga) + '</span></div><div class="m"><span>' + esc(p.kawasan) + '</span></div></button>'; }).join('') +
      (items.length > 3 ? '<div class="more">+' + (items.length - 3) + ' usulan lainnya</div>' : (items.length ? '' : '<div class="more" style="padding:14px 0">Belum ada usulan</div>')) + '</div>';
  }).join('') + '</div>';
  // sebaran jenis mitra
  const jn = {}; D.forEach(function (p) { jn[p.jenis_mitra] = (jn[p.jenis_mitra] || 0) + 1; });
  let jk = Object.keys(jn).sort(function (a, b) { return jn[b] - jn[a]; }); const jparts = []; let lain = 0;
  jk.forEach(function (k, i) { if (i < 4) jparts.push({ nm: jenisNama(k), n: jn[k], c: DONUT[i] }); else lain += jn[k]; }); if (lain) jparts.push({ nm: 'Lainnya', n: lain, c: DONUT[4] });
  const jleg = jparts.map(function (p) { return '<li><i style="background:' + p.c + '"></i><span title="' + esc(p.nm) + '">' + esc(p.nm) + '</span><b>' + Math.round(p.n / Math.max(1, D.length) * 100) + '% (' + p.n + ')</b></li>'; }).join('') || '<li style="color:var(--tx-3)">Belum ada data.</li>';
  // sebaran kawasan
  const kw = {}; D.forEach(function (p) { kw[p.kawasan] = (kw[p.kawasan] || 0) + 1; }); const kk = Object.keys(kw).sort(function (a, b) { return kw[b] - kw[a]; }); const mx = Math.max(1, kw[kk[0]] || 1);
  const kbars = kk.length ? kk.map(function (k) { return '<div class="brow"><span title="' + esc(k) + '">' + esc(k) + '</span><div class="bt"><i style="width:' + (kw[k] / mx * 100) + '%"></i></div><b>' + kw[k] + '</b></div>'; }).join('') : '<div class="empty">' + mi('bar_chart') + 'Belum ada data kawasan.</div>';
  // ringkasan anggaran (terpisah dari kartu tahapan)
  const sumB2 = function (l) { return l.reduce(function (a, p) { return a + (Number(p.biaya) || 0); }, 0); };
  const totA = sumB2(D); const nA = D.filter(function (p) { return Number(p.biaya) > 0; }).length;
  const perKaw = {}; D.forEach(function (p) { perKaw[p.kawasan] = (perKaw[p.kawasan] || 0) + (Number(p.biaya) || 0); });
  const kawA = Object.keys(perKaw).sort(function (a, b) { return perKaw[b] - perKaw[a]; }).slice(0, 5); const mxK = Math.max(1, perKaw[kawA[0]] || 1);
  const anggaran = '<div class="card" style="margin-bottom:16px"><div class="card-h"><div class="ic">' + mi('payments') + '</div><div><h3>Ringkasan anggaran</h3><p class="sub">Rencana anggaran seluruh usulan pada filter ini.</p></div></div>' +
    '<div class="angg-grid"><div class="kpi-a"><small>Total rencana anggaran</small><b>' + rpBig(totA) + '</b></div><div class="kpi-a"><small>Usulan beranggaran</small><b>' + nA + ' / ' + D.length + '</b></div><div class="kpi-a"><small>Rata-rata per usulan</small><b>' + rpBig(nA ? totA / nA : 0) + '</b></div></div>' +
    '<div style="margin-top:16px"><div class="bars"><h4 style="margin-bottom:8px">Per kawasan (5 teratas)</h4>' + (kawA.length ? kawA.map(function (k) { return '<div class="brow"><span title="' + esc(k) + '">' + esc(k) + '</span><div class="bt"><i style="width:' + (perKaw[k] / mxK * 100) + '%"></i></div><b>' + rpBig(perKaw[k]) + '</b></div>'; }).join('') : '<div class="empty">Belum ada data.</div>') + '</div></div></div>';
  // perlu tindakan
  const need = D.filter(needsAction).sort(function (a, b) { return a.diubah > b.diubah ? 1 : -1; });
  const nlist = need.slice(0, 4).map(function (p) { return '<button class="act" data-act="open" data-id="' + esc(p.id) + '"><div class="r"><span>' + mi('schedule', 'font-size:14px') + ' Menunggu ' + waitTxt(p.diubah) + '</span><span class="tag tg-b">Tahap ' + p.tahap + '</span></div><div class="tt"><span>' + esc(p.lembaga) + '</span><span class="cta">' + esc(CTA[p.tahap] || 'Buka') + '</span></div><p>' + esc(stageName(p.tahap)) + ' — ' + esc(p.judul) + '</p><div class="r" style="margin-top:4px"><span>' + esc(p.kawasan) + '</span><span>' + esc(p.nomor) + '</span></div></button>'; }).join('') || '<div class="empty">' + mi('task_alt') + 'Tidak ada tindakan tertunda.</div>';
  // linimasa
  const IC = { 'Dibuat': 'note_add', 'Kirim': 'send', 'Kirim Ulang': 'send', 'Disposisi': 'reply', 'Lengkap': 'fact_check', 'Tidak Lengkap': 'edit_note', 'Disepakati': 'handshake', 'Tidak Disepakati': 'block' };
  const tl = S.timeline.filter(function (r) { return ids[r.id_pengajuan]; }).slice(0, 5).map(function (r) { const p = pById(r.id_pengajuan) || {}; return '<div class="tl-c"><div class="tp"><i>' + mi(IC[r.keputusan] || 'task_alt', 'font-size:16px') + '</i><span>' + esc(r.keputusan) + '</span></div><b>' + esc(p.lembaga || '') + '</b><p>' + esc(r.catatan || (p.nomor + ' — ' + (p.judul || ''))) + '</p><small>' + esc(r.pelaku) + ' · ' + ago(r.waktu) + '</small></div>'; }).join('') || '<div class="empty" style="grid-column:1/-1">' + mi('history') + 'Belum ada aktivitas.</div>';
  const per = [['all', 'Semua waktu'], ['30', '30 hari terakhir'], ['90', '90 hari terakhir'], ['thn', 'Tahun ini'], ['thnlalu', 'Tahun lalu']];
  const sub = S.me.peran === 'mitra' ? 'Pantau perkembangan usulan kemitraan Anda dari koordinasi awal hingga monitoring dan evaluasi.' : 'Berikut ringkasan siklus kemitraan pengelolaan kawasan konservasi perairan Sulawesi Tengah hari ini.';
  const canNew = S.me.peran === 'mitra';
  const onboard = (S.daftar.length || S.daftar._loading) ? '' : (canNew
    ? '<div class="onboard"><div><h3>Mulai pengajuan kemitraan pertama Anda</h3><p>Belum ada usulan. Ajukan kemitraan pengelolaan kawasan konservasi dalam tiga langkah singkat.</p><ol><li><i>1</i>Isi data lembaga &amp; usulan</li><li><i>2</i>Tandai lokasi di peta</li><li><i>3</i>Kirim &amp; pantau 12 tahap</li></ol></div><button class="btn btn-p" data-act="newForm">' + mi('add_circle') + ' Ajukan usulan</button></div>'
    : '<div class="onboard"><div><h3>Belum ada usulan masuk</h3><p>Usulan kemitraan dari mitra akan muncul di sini beserta tahapan, area peta, dan tindakan yang menunggu Anda.</p></div></div>');
  setView('<div class="hero"><div><h2>Selamat datang, ' + esc(S.me.nama) + '! 👋</h2><p>' + sub + '</p></div><div class="sp"></div><div class="ctl">' +
    '<label class="sel">' + mi('date_range', 'font-size:16px') + '<select data-chg="dashFilter" data-k="periode" aria-label="Periode">' + per.map(function (x) { return '<option value="' + x[0] + '"' + (S.dash.periode === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
    '<label class="sel">' + mi('tune', 'font-size:16px') + '<select data-chg="dashFilter" data-k="kawasan" aria-label="Kawasan"><option value="">Semua kawasan (' + S.master.kawasan.length + ')</option>' + S.master.kawasan.map(function (k) { return '<option' + (S.dash.kawasan === k.nama ? ' selected' : '') + ' value="' + esc(k.nama) + '">' + esc(k.nama) + '</option>'; }).join('') + '</select></label>' +
    '<button class="btn btn-p" data-act="exportRekap">' + mi('download') + ' Ekspor rekap</button></div></div>' + onboard + kpis +
    '<div class="card" style="margin-bottom:16px"><div class="card-h"><div class="ic">' + mi('account_tree') + '</div><div><h3>Alur 12 tahapan kemitraan konservasi</h3><p class="sub">Distribusi berkas permohonan kemitraan per fase tindak lanjut.</p></div><div class="sp"></div><a class="lnk" data-act="goDaftar" data-p="{}">Lihat seluruh pipeline ›</a></div>' + phases + '</div>' + anggaran +
    '<div class="g3x"><div class="card"><h3>Sebaran jenis calon mitra</h3><p class="sub">Komposisi pemohon aktif</p><div class="donut">' + donutSvg(jparts, D.length) + '<ul class="leg" style="flex:1;min-width:150px">' + jleg + '</ul></div></div>' +
    '<div class="card bars"><h3>Sebaran kawasan konservasi</h3><p class="sub">Jumlah usulan per kawasan</p>' + kbars + '</div>' +
    '<div class="card gauge"><h3 style="text-align:left">Capaian target monev</h3><p class="sub" style="text-align:left">Rata-rata ' + mon.length + ' laporan monitoring</p>' + gauge(avg === null ? 0 : avg) + '<div class="gstats"><div><small>Target</small><b>100%</b></div><div class="hl"><small>Terealisasi</small><b>' + (avg === null ? '—' : avg.toFixed(1) + '%') + '</b></div><div><small>Selisih</small><b>' + (avg === null ? '—' : (100 - avg).toFixed(1) + '%') + '</b></div></div></div></div>' +
    '<div class="g-map"><div class="card"><div class="card-h"><div><h3>Peta zonasi kemitraan aktif</h3><p class="sub">Batas kawasan (garis putus-putus) dan area pengelolaan usulan.</p></div><div class="sp"></div><a class="lnk" data-act="goPeta">Buka peta penuh ›</a></div><div class="mapbox mid" id="dashMap"></div><div class="map-legend" id="dashLeg"></div></div>' +
    '<div class="card"><div class="card-h"><div class="ic" style="background:var(--coral-l);color:var(--coral)">' + mi('notifications_active') + '</div><div><h3>Perlu tindakan</h3></div><div class="sp"></div><span class="tag tg-w">' + need.length + ' prioritas</span></div>' + nlist + (need.length ? '<button class="btn btn-o btn-block btn-s" data-act="goDaftar" data-p=\'{"aksi":1}\'>Lihat semua (' + need.length + ')</button>' : '') + '</div></div>' +
    '<div class="card"><div class="card-h"><div class="ic" style="background:var(--bg);color:var(--tx-2)">' + mi('history') + '</div><div><h3>Linimasa riwayat & progres sistem</h3></div><div class="sp"></div><a class="lnk" data-act="goDaftar" data-p="{}">Lihat pengajuan ›</a></div><div class="tl-h">' + tl + '</div></div>' +
    '<div class="prinsip"><div class="ic">' + mi('balance') + '</div><div class="tx"><b>Prinsip akuntabilitas & kerangka regulasi konservasi</b><p>Kemitraan pengelolaan kawasan konservasi perairan Provinsi Sulawesi Tengah dijalankan melalui 12 tahapan yang terdokumentasi. Setiap keputusan tercatat pada jejak audit, dan penyusunan, pemaparan, serta penandatanganan PKS mengikuti ketentuan peraturan perundang-undangan yang berlaku.</p></div><button class="btn" data-act="bantuan">' + mi('menu_book') + ' Panduan tata kelola</button></div>');
  // peta ringkas
  const draw = function () {
    const pt = S.peta; if (!pt) return; const ar = pt.areas.filter(function (a) { return ids[a.id_pengajuan]; });
    const bt = pt.batas.filter(function (b) { return !S.dash.kawasan || b.kawasan === S.dash.kawasan; });
    if (!S._dm) return; S._dm.update(bt, ar);
    const lg = $('dashLeg'); if (lg) lg.innerHTML = (pt.batas.length || ar.length) ? petaLegend() : '<span>Belum ada area/batas yang diunggah.</span>';
  };
  S._dm = MapKit.overview($('dashMap'), { scroll: false, onOpen: function (id) { navigateTo('detail', { id: id }); } });
  draw(); loadPeta().then(function () { if (S.view === 'dashboard') draw(); }).catch(function (e) { console.warn('peta', e && e.message); });
}
function petaLegend() { return '<span><i style="background:rgba(14,143,148,.15);border:2px dashed #0a6f73"></i>Batas kawasan</span>' + ['Berjalan', 'Perlu dilengkapi', 'Pelaksanaan', 'Selesai', 'Draft'].map(function (k) { return '<span><i style="background:' + MapKit.WARNA[k] + '"></i>' + k + '</span>'; }).join(''); }

/* ----------------------------- Berita Acara & PKS ----------------------------- */
function vDokumen() {
  setTitle('Berita Acara & PKS');
  setView('<div class="ph"><div><h2>Berita Acara & PKS</h2><p>Dokumen resmi seluruh pengajuan yang dapat Anda akses.</p></div></div><div class="pill-filter" id="dkTabs" style="margin-bottom:14px"></div><div id="dkBody">' + skel() + '</div>');
  const draw = function () {
    const r = S.dok; if (!r || S.view !== 'dokumen') return;
    const all = r.ba.map(function (x) { return Object.assign({ _t: 'Berita Acara ' + x.jenis, _k: 'ba', _st: x.status, _ok: x.status === 'Disahkan' }, x); }).concat(r.pks.map(function (x) { return Object.assign({ _t: 'Perjanjian Kemitraan (PKS)', _k: 'pks', _st: x.status, _ok: x.status === 'Ditandatangani' }, x); }));
    const tabs = [['semua', 'Semua (' + all.length + ')'], ['ba', 'Berita Acara (' + r.ba.length + ')'], ['pks', 'PKS (' + r.pks.length + ')']];
    $('dkTabs').innerHTML = tabs.map(function (t) { return '<button class="' + (S.dokTab === t[0] ? 'on' : '') + '" data-act="dokTab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    const rows = all.filter(function (x) { return S.dokTab === 'semua' || x._k === S.dokTab; });
    $('dkBody').innerHTML = rows.length ? '<div class="grid g2">' + rows.map(function (x) {
      return '<div class="card"><div class="card-h" style="margin-bottom:6px"><div class="ic" style="background:' + (x._ok ? 'var(--green-l);color:var(--green-d)' : 'var(--bg);color:var(--tx-2)') + '">' + mi(x._k === 'pks' ? 'handshake' : 'description') + '</div><div style="min-width:0"><h3 style="font-size:14px">' + esc(x._t) + '</h3><p class="sub">' + esc(x.nomor || '(belum bernomor)') + '</p></div><div class="sp"></div><span class="chip ' + (x._ok ? 'c-ok' : 'c-draft') + '">' + esc(x._st) + '</span></div>' +
        '<p class="t-b">' + esc(x.judul) + '</p><p class="t-sub">' + esc(x.nomor_pengajuan) + ' · ' + esc(x.lembaga) + ' · ' + esc(x.kawasan) + '</p>' +
        (x._ok && x.kode ? '<p class="t-sub" style="margin-top:8px">Kode verifikasi:</p><div class="codebox">' + esc(x.kode) + '</div>' : '') +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn btn-o btn-s" data-act="openTab" data-id="' + esc(x.id_pengajuan) + '" data-tab="ba">' + mi('open_in_new', 'font-size:16px') + ' Buka pengajuan</button>' + (x._ok && x.kode ? '<button class="btn btn-o btn-s" data-act="copyKode" data-k="' + esc(x.kode) + '">' + mi('content_copy', 'font-size:16px') + ' Salin kode</button>' : '') + '</div></div>';
    }).join('') + '</div>' : '<div class="card empty">' + mi('description') + 'Belum ada dokumen.</div>';
  };
  S._dokDraw = draw; if (S.dok) draw();
  api('dokumen_list').then(function (r) { S.dok = r; draw(); }).catch(function (e) { if (!S.dok) $('dkBody').innerHTML = '<div class="callout bad">' + mi('error') + '<span>' + esc(e.message) + '</span></div>'; });
}

/* ----------------------------- Laporan & Statistik ----------------------------- */
function vStatistik() {
  setTitle('Laporan & Statistik'); const D = S.daftar.filter(function (p) { return !p._pending; });
  const act = function (p) { return FINAL.indexOf(p.status) === -1; };
  const sumB = function (a) { return a.reduce(function (s, p) { return s + (Number(p.biaya) || 0); }, 0); };
  const months = []; const n = new Date(); for (let i = 11; i >= 0; i--) { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), n: 0, l: d.toLocaleDateString('id-ID', { month: 'short' }) }); }
  D.forEach(function (p) { const d = new Date(p.dibuat); months.forEach(function (m) { if (m.y === d.getFullYear() && m.m === d.getMonth()) m.n++; }); });
  const mxm = Math.max(1, Math.max.apply(null, months.map(function (m) { return m.n; })));
  const chart = '<div class="bar-chart" role="img" aria-label="Pengajuan per bulan">' + months.map(function (m) { return '<div class="b"><em>' + (m.n || '') + '</em><i style="height:' + (m.n / mxm * 100) + '%"></i><span>' + m.l + '</span></div>'; }).join('') + '</div>';
  const jn = {}; D.forEach(function (p) { jn[p.jenis_mitra] = (jn[p.jenis_mitra] || 0) + 1; });
  let jk = Object.keys(jn).sort(function (a, b) { return jn[b] - jn[a]; }); const jparts = []; let lain = 0;
  jk.forEach(function (k, i) { if (i < 4) jparts.push({ nm: jenisNama(k), n: jn[k], c: DONUT[i] }); else lain += jn[k]; }); if (lain) jparts.push({ nm: 'Lainnya', n: lain, c: DONUT[4] });
  const jleg = jparts.map(function (p) { return '<li><i style="background:' + p.c + '"></i><span title="' + esc(p.nm) + '">' + esc(p.nm) + '</span><b>' + Math.round(p.n / Math.max(1, D.length) * 100) + '% (' + p.n + ')</b></li>'; }).join('') || '<li style="color:var(--tx-3)">Belum ada data.</li>';
  // sebaran kawasan
  const kw = {}; D.forEach(function (p) { kw[p.kawasan] = (kw[p.kawasan] || 0) + 1; }); const kk = Object.keys(kw).sort(function (a, b) { return kw[b] - kw[a]; }); const mx = Math.max(1, kw[kk[0]] || 1);
  const kbars = kk.length ? kk.map(function (k) { return '<div class="brow"><span title="' + esc(k) + '">' + esc(k) + '</span><div class="bt"><i style="width:' + (kw[k] / mx * 100) + '%"></i></div><b>' + kw[k] + '</b></div>'; }).join('') : '<div class="empty">' + mi('bar_chart') + 'Belum ada data kawasan.</div>';
  // ringkasan anggaran (terpisah dari kartu tahapan)
  const sumB2 = function (l) { return l.reduce(function (a, p) { return a + (Number(p.biaya) || 0); }, 0); };
  const totA = sumB2(D); const nA = D.filter(function (p) { return Number(p.biaya) > 0; }).length;
  const perKaw = {}; D.forEach(function (p) { perKaw[p.kawasan] = (perKaw[p.kawasan] || 0) + (Number(p.biaya) || 0); });
  const kawA = Object.keys(perKaw).sort(function (a, b) { return perKaw[b] - perKaw[a]; }).slice(0, 5); const mxK = Math.max(1, perKaw[kawA[0]] || 1);
  const anggaran = '<div class="card" style="margin-bottom:16px"><div class="card-h"><div class="ic">' + mi('payments') + '</div><div><h3>Ringkasan anggaran</h3><p class="sub">Rencana anggaran seluruh usulan pada filter ini.</p></div></div>' +
    '<div class="angg-grid"><div class="kpi-a"><small>Total rencana anggaran</small><b>' + rpBig(totA) + '</b></div><div class="kpi-a"><small>Usulan beranggaran</small><b>' + nA + ' / ' + D.length + '</b></div><div class="kpi-a"><small>Rata-rata per usulan</small><b>' + rpBig(nA ? totA / nA : 0) + '</b></div></div>' +
    '<div style="margin-top:16px"><div class="bars"><h4 style="margin-bottom:8px">Per kawasan (5 teratas)</h4>' + (kawA.length ? kawA.map(function (k) { return '<div class="brow"><span title="' + esc(k) + '">' + esc(k) + '</span><div class="bt"><i style="width:' + (perKaw[k] / mxK * 100) + '%"></i></div><b>' + rpBig(perKaw[k]) + '</b></div>'; }).join('') : '<div class="empty">Belum ada data.</div>') + '</div></div></div>';
  // perlu tindakan
  const need = D.filter(needsAction).sort(function (a, b) { return a.diubah > b.diubah ? 1 : -1; });
  const nlist = need.slice(0, 4).map(function (p) { return '<button class="act" data-act="open" data-id="' + esc(p.id) + '"><div class="r"><span>' + mi('schedule', 'font-size:14px') + ' Menunggu ' + waitTxt(p.diubah) + '</span><span class="tag tg-b">Tahap ' + p.tahap + '</span></div><div class="tt"><span>' + esc(p.lembaga) + '</span><span class="cta">' + esc(CTA[p.tahap] || 'Buka') + '</span></div><p>' + esc(stageName(p.tahap)) + ' — ' + esc(p.judul) + '</p><div class="r" style="margin-top:4px"><span>' + esc(p.kawasan) + '</span><span>' + esc(p.nomor) + '</span></div></button>'; }).join('') || '<div class="empty">' + mi('task_alt') + 'Tidak ada tindakan tertunda.</div>';
  // linimasa
  const IC = { 'Dibuat': 'note_add', 'Kirim': 'send', 'Kirim Ulang': 'send', 'Disposisi': 'reply', 'Lengkap': 'fact_check', 'Tidak Lengkap': 'edit_note', 'Disepakati': 'handshake', 'Tidak Disepakati': 'block' };
  const tl = S.timeline.filter(function (r) { return ids[r.id_pengajuan]; }).slice(0, 5).map(function (r) { const p = pById(r.id_pengajuan) || {}; return '<div class="tl-c"><div class="tp"><i>' + mi(IC[r.keputusan] || 'task_alt', 'font-size:16px') + '</i><span>' + esc(r.keputusan) + '</span></div><b>' + esc(p.lembaga || '') + '</b><p>' + esc(r.catatan || (p.nomor + ' — ' + (p.judul || ''))) + '</p><small>' + esc(r.pelaku) + ' · ' + ago(r.waktu) + '</small></div>'; }).join('') || '<div class="empty" style="grid-column:1/-1">' + mi('history') + 'Belum ada aktivitas.</div>';
  const per = [['all', 'Semua waktu'], ['30', '30 hari terakhir'], ['90', '90 hari terakhir'], ['thn', 'Tahun ini'], ['thnlalu', 'Tahun lalu']];
  const sub = S.me.peran === 'mitra' ? 'Pantau perkembangan usulan kemitraan Anda dari koordinasi awal hingga monitoring dan evaluasi.' : 'Berikut ringkasan siklus kemitraan pengelolaan kawasan konservasi perairan Sulawesi Tengah hari ini.';
  const canNew = S.me.peran === 'mitra';
  const onboard = (S.daftar.length || S.daftar._loading) ? '' : (canNew
    ? '<div class="onboard"><div><h3>Mulai pengajuan kemitraan pertama Anda</h3><p>Belum ada usulan. Ajukan kemitraan pengelolaan kawasan konservasi dalam tiga langkah singkat.</p><ol><li><i>1</i>Isi data lembaga &amp; usulan</li><li><i>2</i>Tandai lokasi di peta</li><li><i>3</i>Kirim &amp; pantau 12 tahap</li></ol></div><button class="btn btn-p" data-act="newForm">' + mi('add_circle') + ' Ajukan usulan</button></div>'
    : '<div class="onboard"><div><h3>Belum ada usulan masuk</h3><p>Usulan kemitraan dari mitra akan muncul di sini beserta tahapan, area peta, dan tindakan yang menunggu Anda.</p></div></div>');
  setView('<div class="hero"><div><h2>Selamat datang, ' + esc(S.me.nama) + '! 👋</h2><p>' + sub + '</p></div><div class="sp"></div><div class="ctl">' +
    '<label class="sel">' + mi('date_range', 'font-size:16px') + '<select data-chg="dashFilter" data-k="periode" aria-label="Periode">' + per.map(function (x) { return '<option value="' + x[0] + '"' + (S.dash.periode === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
    '<label class="sel">' + mi('tune', 'font-size:16px') + '<select data-chg="dashFilter" data-k="kawasan" aria-label="Kawasan"><option value="">Semua kawasan (' + S.master.kawasan.length + ')</option>' + S.master.kawasan.map(function (k) { return '<option' + (S.dash.kawasan === k.nama ? ' selected' : '') + ' value="' + esc(k.nama) + '">' + esc(k.nama) + '</option>'; }).join('') + '</select></label>' +
    '<button class="btn btn-p" data-act="exportRekap">' + mi('download') + ' Ekspor rekap</button></div></div>' + onboard + kpis +
    '<div class="card" style="margin-bottom:16px"><div class="card-h"><div class="ic">' + mi('account_tree') + '</div><div><h3>Alur 12 tahapan kemitraan konservasi</h3><p class="sub">Distribusi berkas permohonan kemitraan per fase tindak lanjut.</p></div><div class="sp"></div><a class="lnk" data-act="goDaftar" data-p="{}">Lihat seluruh pipeline ›</a></div>' + phases + '</div>' + anggaran +
    '<div class="g3x"><div class="card"><h3>Sebaran jenis calon mitra</h3><p class="sub">Komposisi pemohon aktif</p><div class="donut">' + donutSvg(jparts, D.length) + '<ul class="leg" style="flex:1;min-width:150px">' + jleg + '</ul></div></div>' +
    '<div class="card bars"><h3>Sebaran kawasan konservasi</h3><p class="sub">Jumlah usulan per kawasan</p>' + kbars + '</div>' +
    '<div class="card gauge"><h3 style="text-align:left">Capaian target monev</h3><p class="sub" style="text-align:left">Rata-rata ' + mon.length + ' laporan monitoring</p>' + gauge(avg === null ? 0 : avg) + '<div class="gstats"><div><small>Target</small><b>100%</b></div><div class="hl"><small>Terealisasi</small><b>' + (avg === null ? '—' : avg.toFixed(1) + '%') + '</b></div><div><small>Selisih</small><b>' + (avg === null ? '—' : (100 - avg).toFixed(1) + '%') + '</b></div></div></div></div>' +
    '<div class="g-map"><div class="card"><div class="card-h"><div><h3>Peta zonasi kemitraan aktif</h3><p class="sub">Batas kawasan (garis putus-putus) dan area pengelolaan usulan.</p></div><div class="sp"></div><a class="lnk" data-act="goPeta">Buka peta penuh ›</a></div><div class="mapbox mid" id="dashMap"></div><div class="map-legend" id="dashLeg"></div></div>' +
    '<div class="card"><div class="card-h"><div class="ic" style="background:var(--coral-l);color:var(--coral)">' + mi('notifications_active') + '</div><div><h3>Perlu tindakan</h3></div><div class="sp"></div><span class="tag tg-w">' + need.length + ' prioritas</span></div>' + nlist + (need.length ? '<button class="btn btn-o btn-block btn-s" data-act="goDaftar" data-p=\'{"aksi":1}\'>Lihat semua (' + need.length + ')</button>' : '') + '</div></div>' +
    '<div class="card"><div class="card-h"><div class="ic" style="background:var(--bg);color:var(--tx-2)">' + mi('history') + '</div><div><h3>Linimasa riwayat & progres sistem</h3></div><div class="sp"></div><a class="lnk" data-act="goDaftar" data-p="{}">Lihat pengajuan ›</a></div><div class="tl-h">' + tl + '</div></div>' +
    '<div class="prinsip"><div class="ic">' + mi('balance') + '</div><div class="tx"><b>Prinsip akuntabilitas & kerangka regulasi konservasi</b><p>Kemitraan pengelolaan kawasan konservasi perairan Provinsi Sulawesi Tengah dijalankan melalui 12 tahapan yang terdokumentasi. Setiap keputusan tercatat pada jejak audit, dan penyusunan, pemaparan, serta penandatanganan PKS mengikuti ketentuan peraturan perundang-undangan yang berlaku.</p></div><button class="btn" data-act="bantuan">' + mi('menu_book') + ' Panduan tata kelola</button></div>');
  // peta ringkas
  const draw = function () {
    const pt = S.peta; if (!pt) return; const ar = pt.areas.filter(function (a) { return ids[a.id_pengajuan]; });
    const bt = pt.batas.filter(function (b) { return !S.dash.kawasan || b.kawasan === S.dash.kawasan; });
    if (!S._dm) return; S._dm.update(bt, ar);
    const lg = $('dashLeg'); if (lg) lg.innerHTML = (pt.batas.length || ar.length) ? petaLegend() : '<span>Belum ada area/batas yang diunggah.</span>';
  };
  S._dm = MapKit.overview($('dashMap'), { scroll: false, onOpen: function (id) { navigateTo('detail', { id: id }); } });
  draw(); loadPeta().then(function () { if (S.view === 'dashboard') draw(); }).catch(function (e) { console.warn('peta', e && e.message); });
}
function petaLegend() { return '<span><i style="background:rgba(14,143,148,.15);border:2px dashed #0a6f73"></i>Batas kawasan</span>' + ['Berjalan', 'Perlu dilengkapi', 'Pelaksanaan', 'Selesai', 'Draft'].map(function (k) { return '<span><i style="background:' + MapKit.WARNA[k] + '"></i>' + k + '</span>'; }).join(''); }

/* ----------------------------- Berita Acara & PKS ----------------------------- */
function vDokumen() {
  setTitle('Berita Acara & PKS');
  setView('<div class="ph"><div><h2>Berita Acara & PKS</h2><p>Dokumen resmi seluruh pengajuan yang dapat Anda akses.</p></div></div><div class="pill-filter" id="dkTabs" style="margin-bottom:14px"></div><div id="dkBody">' + skel() + '</div>');
  const draw = function () {
    const r = S.dok; if (!r || S.view !== 'dokumen') return;
    const all = r.ba.map(function (x) { return Object.assign({ _t: 'Berita Acara ' + x.jenis, _k: 'ba', _st: x.status, _ok: x.status === 'Disahkan' }, x); }).concat(r.pks.map(function (x) { return Object.assign({ _t: 'Perjanjian Kemitraan (PKS)', _k: 'pks', _st: x.status, _ok: x.status === 'Ditandatangani' }, x); }));
    const tabs = [['semua', 'Semua (' + all.length + ')'], ['ba', 'Berita Acara (' + r.ba.length + ')'], ['pks', 'PKS (' + r.pks.length + ')']];
    $('dkTabs').innerHTML = tabs.map(function (t) { return '<button class="' + (S.dokTab === t[0] ? 'on' : '') + '" data-act="dokTab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    const rows = all.filter(function (x) { return S.dokTab === 'semua' || x._k === S.dokTab; });
    $('dkBody').innerHTML = rows.length ? '<div class="grid g2">' + rows.map(function (x) {
      return '<div class="card"><div class="card-h" style="margin-bottom:6px"><div class="ic" style="background:' + (x._ok ? 'var(--green-l);color:var(--green-d)' : 'var(--bg);color:var(--tx-2)') + '">' + mi(x._k === 'pks' ? 'handshake' : 'description') + '</div><div style="min-width:0"><h3 style="font-size:14px">' + esc(x._t) + '</h3><p class="sub">' + esc(x.nomor || '(belum bernomor)') + '</p></div><div class="sp"></div><span class="chip ' + (x._ok ? 'c-ok' : 'c-draft') + '">' + esc(x._st) + '</span></div>' +
        '<p class="t-b">' + esc(x.judul) + '</p><p class="t-sub">' + esc(x.nomor_pengajuan) + ' · ' + esc(x.lembaga) + ' · ' + esc(x.kawasan) + '</p>' +
        (x._ok && x.kode ? '<p class="t-sub" style="margin-top:8px">Kode verifikasi:</p><div class="codebox">' + esc(x.kode) + '</div>' : '') +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn btn-o btn-s" data-act="openTab" data-id="' + esc(x.id_pengajuan) + '" data-tab="ba">' + mi('open_in_new', 'font-size:16px') + ' Buka pengajuan</button>' + (x._ok && x.kode ? '<button class="btn btn-o btn-s" data-act="copyKode" data-k="' + esc(x.kode) + '">' + mi('content_copy', 'font-size:16px') + ' Salin kode</button>' : '') + '</div></div>';
    }).join('') + '</div>' : '<div class="card empty">' + mi('description') + 'Belum ada dokumen.</div>';
  };
  S._dokDraw = draw; if (S.dok) draw();
  api('dokumen_list').then(function (r) { S.dok = r; draw(); }).catch(function (e) { if (!S.dok) $('dkBody').innerHTML = '<div class="callout bad">' + mi('error') + '<span>' + esc(e.message) + '</span></div>'; });
}

/* ----------------------------- Laporan & Statistik ----------------------------- */
function vStatistik() {
  setTitle('Laporan & Statistik'); const D = S.daftar.filter(function (p) { return !p._pending; });
  const act = function (p) { return FINAL.indexOf(p.status) === -1; };
  const sumB = function (a) { return a.reduce(function (s, p) { return s + (Number(p.biaya) || 0); }, 0); };
  const months = []; const n = new Date(); for (let i = 11; i >= 0; i--) { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), n: 0, l: d.toLocaleDateString('id-ID', { month: 'short' }) }); }
  D.forEach(function (p) { const d = new Date(p.dibuat); months.forEach(function (m) { if (m.y === d.getFullYear() && m.m === d.getMonth()) m.n++; }); });
  const mxm = Math.max(1, Math.max.apply(null, months.map(function (m) { return m.n; })));
  const chart = '<div class="bar-chart" role="img" aria-label="Pengajuan per bulan">' + months.map(function (m) { return '<div class="b"><em>' + (m.n || '') + '</em><i style="height:' + (m.n / mxm * 100) + '%"></i><span>' + m.l + '</span></div>'; }).join('') + '</div>';
  const faseRows = PHASES.map(function (ph) { const it = D.filter(function (p) { return act(p) && p.tahap >= ph.t1 && p.tahap <= ph.t2; }); return '<tr style="cursor:default"><td>' + esc(ph.nama) + '</td><td>' + it.length + '</td><td>' + rpBig(sumB(it)) + '</td></tr>'; }).join('') +
    '<tr style="cursor:default"><td>Selesai</td><td>' + D.filter(function (p) { return p.status === 'Selesai'; }).length + '</td><td>' + rpBig(sumB(D.filter(function (p) { return p.status === 'Selesai'; }))) + '</td></tr><tr style="cursor:default"><td>Tidak dilanjutkan</td><td>' + D.filter(function (p) { return p.status === 'Tidak dilanjutkan'; }).length + '</td><td>' + rpBig(sumB(D.filter(function (p) { return p.status === 'Tidak dilanjutkan'; }))) + '</td></tr>';
  const jn = {}; D.forEach(function (p) { jn[p.jenis_mitra] = (jn[p.jenis_mitra] || 0) + 1; });
  const jRows = Object.keys(jn).sort(function (a, b) { return jn[b] - jn[a]; }).map(function (k) { return '<tr style="cursor:default"><td>' + esc(jenisNama(k)) + '</td><td>' + jn[k] + '</td></tr>'; }).join('') || '<tr><td colspan="2" class="t-sub">Belum ada data.</td></tr>';
  const kwRows = function () {
    return S.master.kawasan.map(function (k) { const it = D.filter(function (p) { return p.kawasan === k.nama; }); const ids = {}; it.forEach(function (p) { ids[p.id] = 1; }); return '<tr style="cursor:default"><td>' + esc(k.nama) + '</td><td>' + it.length + '</td><td>' + rpBig(sumB(it)) + '</td></tr>'; }).join('');
  };
  const avg = S.monev.length ? S.monev.reduce(function (a, m) { return a + Number(m.capaian_persen || 0); }, 0) / S.monev.length : null;
  setView('<div class="ph"><div><h2>Laporan & statistik</h2><p>Ringkasan seluruh pengajuan yang dapat Anda akses.</p></div><div class="sp"></div><button class="btn btn-o" data-act="exportRekap">' + mi('download') + ' Ekspor rekap pengajuan (CSV)</button><button class="btn btn-o" data-act="exportMonev">' + mi('download') + ' Ekspor monev (CSV)</button></div>' +
    '<div class="kpis"><div class="kpi2"><div class="lb"><span>Total pengajuan</span></div><div class="vl">' + D.length + '</div></div><div class="kpi2"><div class="lb"><span>Masih berjalan</span></div><div class="vl">' + D.filter(act).length + '</div></div><div class="kpi2"><div class="lb"><span>Selesai</span></div><div class="vl">' + D.filter(function (p) { return p.status === 'Selesai'; }).length + '</div></div><div class="kpi2"><div class="lb"><span>Total anggaran usulan</span></div><div class="vl" style="font-size:20px">' + rpBig(sumB(D)) + '</div></div><div class="kpi2"><div class="lb"><span>Rata-rata capaian monev</span></div><div class="vl">' + (avg === null ? '—' : avg.toFixed(1) + '%') + '</div><div class="ft">' + S.monev.length + ' laporan</div></div></div>' +
    '<div class="card" style="margin-bottom:16px"><h3>Pengajuan dibuat per bulan</h3><p class="sub">12 bulan terakhir</p>' + chart + '</div>' +
    '<div class="grid g2" style="margin-bottom:16px"><div class="card"><h3>Per fase</h3><div class="tbl-wrap" style="display:block;margin-top:8px"><table style="min-width:0"><thead><tr><th>Fase</th><th>Usulan</th></tr></thead><tbody>' + faseRows + '</tbody></table></div></div>' +
    '<div class="card"><h3>Per jenis mitra</h3><div class="tbl-wrap" style="display:block;margin-top:8px"><table style="min-width:0"><thead><tr><th>Jenis</th><th>Usulan</th></tr></thead><tbody>' + jRows + '</tbody></table></div></div></div>' +
    '<div class="card"><h3>Per kawasan konservasi</h3><div class="tbl-wrap" style="display:block;margin-top:8px"><table style="min-width:0"><thead><tr><th>Kawasan</th><th>Usulan</th><th>Anggaran</th></tr></thead><tbody id="kwRows">' + kwRows() + '</tbody></table></div></div>');
  loadPeta().then(function () { const e = $('kwRows'); if (e && S.view === 'statistik') e.innerHTML = kwRows(); }).catch(function () {});
}
function exportRekap() {
  const D = (S.view === 'dashboard' ? dashData() : S.daftar).filter(function (p) { return !p._pending; });
  const head = ['Nomor', 'Judul', 'Lembaga', 'Jenis mitra', 'Kawasan', 'Zona', 'Lokasi', 'Anggaran (Rp)', 'Sumber pembiayaan', 'Jangka waktu', 'Tahap', 'Nama tahap', 'Status', 'Dibuat', 'Diperbarui'];
  downloadCSV('rekap-pengajuan-' + today() + '.csv', [head].concat(D.map(function (p) { return [p.nomor, p.judul, p.lembaga, jenisNama(p.jenis_mitra), p.kawasan, p.zona, p.lokasi, p.biaya, p.sumber, p.jangka, p.tahap, stageName(p.tahap), p.status, p.dibuat, p.diubah]; })));
  toast('ok', 'Rekap diekspor (' + D.length + ' baris).');
}
function exportMonev() {
  downloadCSV('rekap-monev-' + today() + '.csv', [['Nomor pengajuan', 'Lembaga', 'Periode', 'Target', 'Capaian (%)', 'Realisasi pembiayaan', 'Kendala', 'Rekomendasi', 'Pelapor', 'Dibuat']].concat(S.monev.map(function (m) { const p = pById(m.id_pengajuan) || {}; return [p.nomor, p.lembaga, m.periode, m.target, m.capaian_persen, m.realisasi_pembiayaan, m.kendala, m.rekomendasi, m.pelapor, m.dibuat]; })));
  toast('ok', 'Rekap monev diekspor (' + S.monev.length + ' baris).');
}

/* ----------------------------- Peta Kawasan ----------------------------- */
function vPeta() {
  setTitle('Peta Kawasan'); const adm = isSuper();
  setView('<div class="ph"><div><h2>Peta kawasan & area pengelolaan</h2><p>Batas kawasan konservasi dan area pengelolaan yang diusulkan mitra.</p></div><div class="sp"></div>' + (adm ? '<button class="btn btn-o" data-act="nav2" data-v="master">' + mi('edit_location_alt') + ' Kelola batas kawasan</button>' : '') + '</div>' +
    '<div class="map-layout"><div class="card"><div class="mapbox tall" id="petaMap"></div><div class="map-legend">' + petaLegend() + '</div><p class="hint" id="petaEmpty" style="margin-top:6px"></p></div>' +
    '<div><div class="card" style="margin-bottom:16px"><h3>Saring peta</h3><div class="fld" style="margin-top:10px"><label>Kawasan</label><select class="in" data-chg="petaFilter" data-k="kawasan"><option value="">Semua kawasan</option>' + S.master.kawasan.map(function (k) { return '<option' + (S.petaF.kawasan === k.nama ? ' selected' : '') + ' value="' + esc(k.nama) + '">' + esc(k.nama) + '</option>'; }).join('') + '</select></div>' +
    '<div class="fld"><label>Status</label><select class="in" data-chg="petaFilter" data-k="grup"><option value="">Semua status</option>' + ['Berjalan', 'Perlu dilengkapi', 'Pelaksanaan', 'Selesai', 'Tidak dilanjutkan'].map(function (g) { return '<option' + (S.petaF.grup === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></div><div id="petaSum" class="t-sub"></div></div>' +
    '<div class="card"><h3>Cek lokasi kawasan</h3><p class="sub">Klik titik pada peta atau isi koordinat untuk mengetahui kawasan dan area usulan di lokasi tersebut.</p><div style="display:flex;gap:8px"><input id="cekIn" class="in" placeholder="lintang,bujur  mis. -0.89,119.87" aria-label="Koordinat"><button class="btn btn-p" data-act="cekGo">Periksa</button></div><div id="cekRes" class="chk-res"></div></div></div></div>');
  let marker = null;
  const cek = function (lat, lng) {
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { $('cekRes').innerHTML = '<div class="callout bad">' + mi('error') + '<span>Koordinat tidak valid. Format: lintang,bujur.</span></div>'; return; }
    const m = S._pm && S._pm.map; if (m) { if (marker) m.removeLayer(marker); marker = L.circleMarker([lat, lng], { radius: 7, color: '#F26B4F', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(m); }
    $('cekIn').value = lat.toFixed(6) + ',' + lng.toFixed(6);
    if (!S.peta || !S.peta.batas.length) { $('cekRes').innerHTML = '<div class="callout info">' + mi('info') + '<span>Batas kawasan belum diunggah' + (S.me.peran === 'admin' ? '.' : ' oleh Admin.') + ' Pemeriksaan kawasan belum dapat dilakukan.</span></div>'; return; }
    const r = MapKit.lokasiInfo(lat, lng, S.peta.batas, S.peta.areas);
    $('cekRes').innerHTML = (r.kawasan.length ? '<div class="callout ok">' + mi('check_circle') + '<span>Titik berada di dalam batas: <b>' + r.kawasan.map(esc).join(', ') + '</b></span></div>' : '<div class="callout warn">' + mi('warning') + '<span>Titik berada di <b>luar</b> seluruh batas kawasan yang terdaftar.</span></div>') +
      (r.areas.length ? '<p class="t-sub" style="margin:8px 0 4px">Area usulan di titik ini:</p>' + r.areas.map(function (a) { return '<button class="act" data-act="open" data-id="' + esc(a.id_pengajuan) + '"><div class="tt"><span>' + esc(a.judul) + '</span></div><p>' + esc(a.nomor) + ' · ' + esc(a.lembaga) + '</p></button>'; }).join('') : '');
  };
  S._cek = cek;
  const draw = function () {
    const pt = S.peta; if (!pt || !S._pm || S.view !== 'peta') return; const f = S.petaF;
    const ar = pt.areas.filter(function (a) { return (!f.kawasan || a.kawasan === f.kawasan) && (!f.grup || groupOf(a) === f.grup); });
    const bt = pt.batas.filter(function (b) { return !f.kawasan || b.kawasan === f.kawasan; });
    S._pm.update(bt, ar); $('petaSum').innerHTML = '<b>' + ar.length + '</b> area · ' + bt.length + ' batas kawasan';
    $('petaEmpty').textContent = (!pt.areas.length && !pt.batas.length) ? 'Belum ada area atau batas yang diunggah. Mitra mengunggah Shapefile area pada pengajuannya; Admin mengunggah batas di Data Master & Batas.' : '';
  };
  S._pdraw = draw;
  S._pm = MapKit.overview($('petaMap'), { onOpen: function (id) { navigateTo('detail', { id: id }); }, onClick: cek, fitAreas: true });
  draw(); loadPeta().then(draw).catch(function (e) { $('petaSum').textContent = e.message; });
  if (S.params.cek) setTimeout(function () { const i = $('cekIn'); if (i) i.focus(); }, 100);
}

/* ----------------------------- Verifikasi dokumen ----------------------------- */
function verifHtml(r) { return r.valid ? '<div class="callout ok">' + mi('verified') + '<span><b>Dokumen sah.</b><br>' + esc(r.tipe) + ' ' + esc(r.nomor) + ' (' + esc(r.status) + ')<br>' + esc(r.lembaga) + ' — ' + esc(r.judul) + '<br>' + esc(r.kawasan) + '</span></div>' : '<div class="callout bad">' + mi('error') + '<span>' + esc(r.pesan) + '</span></div>'; }
function vVerifikasi() {
  setTitle('Verifikasi Dokumen');
  setView('<div class="ph"><div><h2>Verifikasi dokumen resmi</h2><p>Periksa keaslian Berita Acara atau PKS menggunakan kode verifikasi pada dokumen.</p></div></div><div class="card" style="max-width:640px"><div class="fld"><label>Kode verifikasi</label><input id="vkKode2" class="in" placeholder="BA:xxxxxxxx-…:xxxxxxxxxxxx atau PKS:…"></div><button class="btn btn-p" id="vkGo" data-act="verifGo">' + mi('verified_user') + ' Periksa</button><div id="vkRes2" style="margin-top:14px"></div></div>');
}

/* ----------------------------- Bantuan ----------------------------- */
function openBantuan() {
  const c = (S.master && S.master.config) || {};
  modal({ title: 'Bantuan & panduan', hideCancel: true, wide: true, body: '<h3 style="font-size:14px;margin:6px 0">Alur 12 tahapan</h3><ol style="padding-left:20px;color:var(--tx-2);columns:2;column-gap:24px;font-size:12.5px">' + S.master.stages.map(function (s) { return '<li style="break-inside:avoid;margin-bottom:4px">' + esc(s.nama) + '</li>'; }).join('') + '</ol>' +
    '<h3 style="font-size:14px;margin:14px 0 6px">Tips</h3><ul style="padding-left:20px;color:var(--tx-2);font-size:13px"><li>Unggah dokumen pada tab <b>Dokumen</b> sebelum menekan <b>Kirim</b>.</li><li>Gambar area pengelolaan pada langkah <b>Lokasi</b> formulir, atau impor GeoJSON / daftar koordinat.</li><li>Pengajuan yang dikembalikan akan menampilkan catatan verifikator pada tab <b>Ringkasan</b>.</li><li>Kode verifikasi Berita Acara/PKS dapat diperiksa siapa saja lewat halaman login.</li></ul>' +
    '<h3 style="font-size:14px;margin:14px 0 6px">Kontak</h3><p style="color:var(--tx-2);font-size:13px">' + (c.helpdesk_email || c.helpdesk_telp ? esc(c.helpdesk_email || '') + ' ' + esc(c.helpdesk_telp || '') : 'Kontak layanan bantuan belum diatur Admin.') + '</p>' });
}

/* ----------------------------- Tab Peta pada detail ----------------------------- */
function canEditAreaP(p) {
  if (FINAL.indexOf(p.status) > -1) return false; const r = S.me.peran;
  return r === 'mitra' && p.id_user === S.me.id && p.tahap === 1 && (p.status === 'Draft' || p.status === 'Perlu dilengkapi'); // area hanya oleh mitra
}
function tPeta(p, d) {
  const edit = canEditAreaP(p); const areas = d.areas || []; const batas = S.peta ? S.peta.batas : [];
  const items = areas.map(function (a) {
    const c = MapKit.cek(MapKit.parse(a.geojson), p.kawasan, batas); const cls = { dalam: 'c-ok', sebagian: 'c-warn', luar: 'c-bad', tanpa_batas: 'c-draft' }[c.status]; const lb = { dalam: 'Di dalam kawasan', sebagian: 'Sebagian di luar', luar: 'Di luar kawasan', tanpa_batas: 'Batas belum ada' }[c.status];
    return '<div class="ck" style="grid-template-columns:1fr auto"><div><div class="nm">' + esc(a.nama) + '</div><div class="t-sub">' + 'oleh ' + esc(a.pembuat) + ' · ' + fmtD(a.diubah) + '</div><span class="chip ' + cls + '" style="margin-top:4px" title="' + esc(c.teks) + '">' + lb + '</span></div>' +
      (edit ? '<div style="display:flex;gap:6px"><button class="btn btn-o btn-s" data-act="areaEdit" data-id="' + esc(a.id) + '">' + mi('edit', 'font-size:16px') + '</button><button class="btn btn-o btn-s" data-act="areaDel" data-id="' + esc(a.id) + '" aria-label="Hapus area">' + mi('delete', 'font-size:16px') + '</button></div>' : '') + '</div>';
  }).join('') || '<div class="empty" style="padding:22px">' + mi('location_off') + 'Belum ada area pengelolaan.</div>';
  return '<div class="grid g-main"><div class="card"><h3>Peta area pengelolaan</h3><p class="sub">Area yang diajukan mitra di ' + esc(p.kawasan) + (isStaff() ? ' — peta langsung memperbesar ke area usulan' : '') + ' (garis putus-putus = batas kawasan).</p><div class="mapbox" id="detMap"></div></div>' +
    '<div class="card"><h3>Daftar area</h3><p class="sub">' + areas.length + ' area</p>' + items + (edit ? '<button class="btn btn-p btn-block" style="margin-top:12px" data-act="areaAdd">' + mi('add_location_alt') + ' Tambah area</button>' : '') + '</div></div>';
}
function afterDetailRender() {
  if (S.view !== 'detail' || S.tab !== 'peta') return; const p = pById(S.params.id), d = detData(), el = $('detMap'); if (!p || !d || !el) return;
  const ov = MapKit.overview(el, { onOpen: function () {}, fitAreas: true }); if (!ov) return;
  const draw = function () { ov.update((S.peta ? S.peta.batas : []).filter(function (b) { return b.kawasan === p.kawasan; }), (d.areas || []).map(function (a) { return Object.assign({}, a, { judul: p.judul, nomor: p.nomor, lembaga: p.lembaga, status: p.status, tahap: p.tahap, id_pengajuan: p.id }); })); };
  draw(); if (!S.peta) loadPeta().then(function () { if (S.view === 'detail' && S.tab === 'peta') renderDetailBody(); }).catch(function () {});
}
function openAreaModal(p, area) {
  const open = function () {
    let ed = null;
    modal({ title: area ? 'Ubah area pengelolaan' : 'Tambah area pengelolaan', wide: true, ok: 'Simpan area', sub: 'Kawasan: <b>' + esc(p.kawasan) + '</b>. Unggah Shapefile (.zip) area kegiatan Anda.',
      body: '<div class="fld"><label>Nama area</label><input class="in" id="arNama" maxlength="80" placeholder="mis. Zona pemanfaatan Pantai Utara" value="' + esc(area ? area.nama : '') + '"></div><div id="arMap"></div>',
      onOk: function () {
        const g = ed && ed.geom(); if (!g) { $('mErr').textContent = 'Unggah Shapefile area terlebih dahulu.'; return false; }
        return api('area_simpan', { id_pengajuan: p.id, id: area ? area.id : undefined, nama: $('arNama').value, geojson: g }).then(function () { S.peta = null; delete S.det[p.id]; toast('ok', 'Area tersimpan.'); loadDetail(p.id, true); });
      } });
    ed = MapKit.editor($('arMap'), { geom: area ? area.geojson : null, kawasan: p.kawasan, batas: S.peta ? S.peta.batas : [], modal: true, shpOnly: true, maxChars: 40000 });
  };
  if (S.peta) open(); else loadPeta().then(open).catch(open);
}
function hapusArea(p, id) {
  modal({ title: 'Hapus area?', body: '<p>Area pengelolaan akan dihapus dari pengajuan ini.</p>', ok: 'Hapus', danger: true, onOk: function () { return api('area_hapus', { id: id }).then(function () { S.peta = null; delete S.det[p.id]; toast('ok', 'Area dihapus.'); loadDetail(p.id, true); }); } });
}

/* ----------------------------- Batas kawasan (Data Master) ----------------------------- */
function warnaCardHtml() {
  return '<div class="card" style="margin-bottom:16px"><h3>Warna kategori area</h3><p class="sub">Atur sendiri warna tiap kategori (mis. zona dari Shapefile). Berlaku di semua peta dan legenda; tersimpan otomatis. Kategori muncul di sini setelah ada batas/area berkategori.</p><div id="warnaList">' + skel() + '</div></div>';
}
function katTerpakai() {
  const u = []; const add = function (k) { if (k && u.indexOf(k) < 0) u.push(k); };
  ((S.peta && S.peta.batas) || []).forEach(function (b) { try { MapKit.katsOf(typeof b.geojson === 'string' ? JSON.parse(b.geojson) : b.geojson).forEach(add); } catch (e) {} });
  ((S.peta && S.peta.areas) || []).forEach(function (a) { try { MapKit.katsOf(typeof a.geojson === 'string' ? JSON.parse(a.geojson) : a.geojson).forEach(add); } catch (e) {} });
  return u.sort();
}
let warnaTimer = null;
function simpanWarna() { clearTimeout(warnaTimer); warnaTimer = setTimeout(function () { api('master_simpan', { config: { warna_kategori: (S.master.config || {}).warna_kategori || {} } }).then(function () { persist(); toast('ok', 'Warna kategori disimpan.'); }).catch(function (e) { toast('bad', e.message); }); }, 700); }
function fillWarna() {
  const el = $('warnaList'); if (!el) return; const ks = katTerpakai(); const cu = (S.master.config && S.master.config.warna_kategori) || {};
  el.innerHTML = ks.length ? ks.map(function (k) { const custom = !!cu[k.trim().toLowerCase()]; return '<div class="ck" style="grid-template-columns:auto 1fr auto;align-items:center"><input type="color" class="clr" data-chg="warna" data-kat="' + esc(k) + '" value="' + esc(MapKit.katWarna(k)) + '" aria-label="Warna ' + esc(k) + '"><div><div class="nm">' + esc(k) + '</div><div class="t-sub">' + (custom ? 'Warna kustom' : 'Warna otomatis') + '</div></div>' + (custom ? '<button type="button" class="btn btn-o btn-s" data-act="warnaReset" data-kat="' + esc(k) + '">Kembalikan</button>' : '<span></span>') + '</div>'; }).join('') : '<div class="empty" style="padding:14px">' + mi('palette') + 'Belum ada area berkategori. Impor Shapefile dengan kolom kategori terlebih dahulu.</div>';
}
function arcRow(l) { return '<input class="in" data-an placeholder="Nama layer" value="' + esc(l.nama || '') + '"><input class="in" data-au placeholder="https://services.arcgis.com/…/FeatureServer/0" value="' + esc(l.url || '') + '"><input class="in" data-ak placeholder="Kolom kategori (opsional)" value="' + esc(l.kolom || '') + '"><span style="white-space:nowrap"><button type="button" class="btn btn-o btn-s" data-act="arcTest">Uji</button> <button type="button" class="btn btn-o btn-s" data-act="arcDel" aria-label="Hapus layer">' + mi('delete') + '</button></span>'; }
function arcCardHtml() {
  const L = ((S.master && S.master.config && S.master.config.arcgis_layers) || []);
  return '<div class="card" style="margin-bottom:16px"><h3>Integrasi ArcGIS Online</h3><p class="sub">Tampilkan layer ArcGIS Online (publik) sebagai lapisan di semua peta — pilih lewat ikon lapisan di pojok peta. Layer fitur (<code>…/FeatureServer/0</code>) dimuat sebagai poligon berwarna per kolom kategori; layer tile (<code>…/MapServer</code>) sebagai peta latar. Layer yang sama bisa diimpor sebagai batas/area lewat tombol <i>Isi koordinat / Impor</i>. Hanya layer berbagi <b>Publik</b> dari <code>*.arcgis.com</code>.</p><div id="arcList">' + L.map(function (l) { return '<div class="arc-row">' + arcRow(l) + '</div>'; }).join('') + '</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-o btn-s" data-act="arcAdd">' + mi('add') + ' Tambah layer</button><button type="button" class="btn btn-o btn-s" data-act="exportGeo">' + mi('download') + ' Ekspor batas &amp; area (GeoJSON untuk ArcGIS)</button></div><p class="hint" style="margin-top:8px">Klik <b>Simpan semua</b> di atas setelah mengubah daftar layer.</p></div>';
}
function batasCardHtml() {
  return '<div class="card" style="margin-bottom:16px"><h3>Batas kawasan di peta</h3><p class="sub">Unggah batas tiap kawasan (Shapefile .zip, GeoJSON, atau gambar manual). Digunakan untuk memeriksa kesesuaian area usulan.</p><div id="batasList">' + skel() + '</div></div>';
}
function fillBatas() {
  const el = $('batasList'); if (!el) return;
  const draw = function () { if (!$('batasList')) return; $('batasList').innerHTML = S.master.kawasan.map(function (k) { const b = S.peta.batas.filter(function (x) { return x.kawasan === k.nama; })[0]; return '<div class="ck" style="grid-template-columns:1fr auto"><div><div class="nm">' + esc(k.nama) + '</div><div class="t-sub">' + (b ? 'Batas terunggah' : 'Belum ada batas') + '</div></div><div style="display:flex;gap:6px"><button class="btn btn-o btn-s" data-act="batasEdit" data-k="' + esc(k.nama) + '">' + mi('edit_location_alt', 'font-size:16px') + ' ' + (b ? 'Ubah' : 'Atur') + '</button>' + (b ? '<button class="btn btn-o btn-s" data-act="batasDel" data-k="' + esc(k.nama) + '" aria-label="Hapus batas">' + mi('delete', 'font-size:16px') + '</button>' : '') + '</div></div>'; }).join(''); };
  loadPeta(true).then(function () { draw(); fillWarna(); }).catch(function (e) { el.innerHTML = '<div class="callout bad">' + mi('error') + '<span>' + esc(e.message) + '</span></div>'; });
}
function openBatasModal(kaw) {
  const b = S.peta && S.peta.batas.filter(function (x) { return x.kawasan === kaw; })[0]; let ed = null;
  modal({ title: 'Batas kawasan: ' + kaw, wide: true, ok: 'Simpan batas', sub: 'Impor Shapefile (.zip) / GeoJSON batas resmi atau gambar poligon. Batas besar akan disederhanakan otomatis agar muat.',
    body: '<div id="btMap"></div>', onOk: function () {
      const g = ed && ed.geom(); if (!g) { $('mErr').textContent = 'Gambar atau impor batas terlebih dahulu.'; return false; }
      return api('batas_simpan', { kawasan: kaw, geojson: g }).then(function () { toast('ok', 'Batas kawasan tersimpan.'); fillBatas(); });
    } });
  ed = MapKit.editor($('btMap'), { geom: b ? b.geojson : null, modal: true, maxChars: 1600000, maxVert: 150000, satelit: true });
}
function hapusBatas(kaw) { modal({ title: 'Hapus batas kawasan?', sub: esc(kaw), ok: 'Hapus', danger: true, onOk: function () { return api('batas_simpan', { kawasan: kaw, geojson: '' }).then(function () { toast('ok', 'Batas dihapus.'); fillBatas(); }); } }); }

/* ----------------------------- Pendaftaran aksi & perubahan ----------------------------- */
Object.assign(ACT, {
  dokItem: function (el) { if (el.disabled) return; S.dokSel = { id: S.params.id, i: Number(el.dataset.i) || 0 }; renderDetailBody(); },
  toggleProf: function () { const p = $('profPop'); p.hidden = !p.hidden; closePop('profPop'); },
  profGo: function (el) { closePop(); navigateTo(el.dataset.v, {}); },
  goPeta: function () { navigateTo('peta', {}); }, cekLokasi: function () { navigateTo('peta', { cek: 1 }); }, bantuan: openBantuan,
  nav2: function (el) { navigateTo(el.dataset.v, {}); },
  exportRekap: exportRekap, exportMonev: exportMonev,
  dokTab: function (el) { S.dokTab = el.dataset.t; if (S._dokDraw) S._dokDraw(); },
  openTab: function (el) { navigateTo('detail', { id: el.dataset.id, tab: el.dataset.tab }); },
  copyKode: function (el) { const k = el.dataset.k; (navigator.clipboard ? navigator.clipboard.writeText(k) : Promise.reject()).then(function () { toast('ok', 'Kode disalin.'); }, function () { toast('bad', 'Tidak dapat menyalin. Salin manual dari kotak kode.'); }); },
  cekGo: function () { const m = String($('cekIn').value).split(/[\s,;]+/).map(Number); if (S._cek) S._cek(m[0], m[1]); },
  verifGo: function (el) { const k = $('vkKode2').value.trim(); if (!k) { toast('bad', 'Masukkan kode verifikasi.'); return; } loadingBtn(el, true); api('verifikasi', { kode: k }).then(function (r) { $('vkRes2').innerHTML = verifHtml(r); }).catch(function (e) { $('vkRes2').innerHTML = '<div class="callout bad">' + mi('error') + '<span>' + esc(e.message) + '</span></div>'; }).then(function () { loadingBtn(el, false); }); },
  areaAdd: function () { openAreaModal(curP(), null); },
  areaEdit: function (el) { const d = detData(); openAreaModal(curP(), d.areas.filter(function (a) { return a.id === el.dataset.id; })[0]); },
  areaDel: function (el) { hapusArea(curP(), el.dataset.id); },
  warnaReset: function (el) { const c = S.master.config = S.master.config || {}; c.warna_kategori = Object.assign({}, c.warna_kategori); delete c.warna_kategori[el.dataset.kat.trim().toLowerCase()]; simpanWarna(); fillWarna(); },
  arcAdd: function () { const w = $('arcList'); const d = document.createElement('div'); d.className = 'arc-row'; d.innerHTML = arcRow({}); w.appendChild(d); },
  arcDel: function (el) { el.closest('.arc-row').remove(); },
  arcTest: function (el) { const r = el.closest('.arc-row'); const u = r.querySelector('[data-au]').value; el.disabled = true; const old = el.textContent; el.textContent = 'Menguji…';
    MapKit.fetchArcgis(u, 1).then(function (fc) { const n = fc.features.length; const keys = Object.keys((fc.features[0] || {}).properties || {}); toast('ok', 'Terhubung: ' + n + (n >= 1000 ? '+' : '') + ' fitur. Kolom: ' + keys.slice(0, 8).join(', ') + (keys.length > 8 ? '…' : '')); }).catch(function (e) { toast('bad', e.message); }).then(function () { el.disabled = false; el.textContent = old; }); },
  exportGeo: function () {
    const feats = []; ((S.peta && S.peta.batas) || []).forEach(function (b) { let g; try { g = typeof b.geojson === 'string' ? JSON.parse(b.geojson) : b.geojson; } catch (e) { return; } if (!g) return; const add = function (geom, kat) { feats.push({ type: 'Feature', properties: { jenis: 'Batas kawasan', kawasan: b.kawasan, kategori: kat || '', luas_ha: b.luas_ha }, geometry: geom }); };
      if (g.type === 'FeatureCollection') g.features.forEach(function (f) { add(f.geometry, f.properties && f.properties.kategori); }); else add(g, ''); });
    ((S.peta && S.peta.areas) || []).forEach(function (a) { let g; try { g = typeof a.geojson === 'string' ? JSON.parse(a.geojson) : a.geojson; } catch (e) { return; } if (!g) return; const add = function (geom, kat) { feats.push({ type: 'Feature', properties: { jenis: 'Area pengelolaan', kawasan: a.kawasan, nomor: a.nomor, mitra: a.lembaga, nama_area: a.nama, kategori: kat || '', status: a.status, luas_ha: a.luas_ha }, geometry: geom }); };
      if (g.type === 'FeatureCollection') g.features.forEach(function (f) { add(f.geometry, f.properties && f.properties.kategori); }); else add(g, ''); });
    if (!feats.length) { toast('bad', 'Belum ada batas atau area untuk diekspor.'); return; }
    const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features: feats })], { type: 'application/geo+json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'si-mitra-peta-' + new Date().toISOString().slice(0, 10) + '.geojson'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); toast('ok', feats.length + ' fitur diekspor. Di ArcGIS Online: Content → New item → Your device.');
  },
  batasEdit: function (el) { openBatasModal(el.dataset.k); }, batasDel: function (el) { hapusBatas(el.dataset.k); }
});
Object.assign(CHG, {
  dashFilter: function (t) { S.dash[t.dataset.k] = t.value; vDashboard(); },
  petaFilter: function (t) { S.petaF[t.dataset.k] = t.value; if (S._pdraw) S._pdraw(); }
});
