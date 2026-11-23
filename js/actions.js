/* ----------------------------- Aksi tahap (optimistic) ----------------------------- */
function curP() { return pById(S.params.id); }
function precheckMaju(p, t) {
  const d = detData(); if (!d) return '';
  if (t.k.indexOf('Kirim') === 0) { const ms = dokMissing(p, d); if (ms.length) { S.tab = 'dokumen'; S.dokSel = { id: p.id, i: Math.max(0, dokItems(p).items.indexOf(ms[0])) }; return 'Dokumen persyaratan belum lengkap (' + ms.length + ' belum diunggah): ' + ms.slice(0, 2).join('; ') + (ms.length > 2 ? ', dst.' : '') + '.'; } }
  if (t.k === 'Pemaparan Selesai' && !(d.jadwal && d.jadwal.status !== 'Dibatalkan')) { S.tab = 'jadwal'; return 'Tentukan jadwal pemaparan terlebih dahulu (tab Jadwal Pemaparan).'; }
  const wajibTtd = { 'Pemaparan Selesai': 'BA Pemaparan', 'Disepakati': 'BA Hasil Penelaahan', 'PKS Ditandatangani': 'PKS Bertanda Tangan' }[t.k];
  if (wajibTtd && !ttdBerkas(d, wajibTtd)) { S.tab = 'ba'; return 'Unggah ' + wajibTtd + ' (hasil pindai bertanda tangan) terlebih dahulu pada tab Berita Acara & PKS.'; }
  if (t.k.indexOf('Kirim') === 0 && !(d.programs && d.programs.length)) { return 'Pilih minimal satu program (program Dinas atau program sendiri) lewat tombol Ubah pengajuan.'; }
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
function ttdUpload(btn, jenis) {
  const p = curP(); const id = 'tt' + jenis.replace(/\W/g, ''); const g = function (k) { const e = $(id + k); return e ? e.value : ''; };
  const fi = $(id + 'F'); const f = fi && fi.files && fi.files[0]; if (!f) { toast('bad', 'Pilih berkas hasil pindai terlebih dahulu.'); return; }
  const ext = f.name.split('.').pop().toLowerCase(); if (ext !== 'pdf') { toast('bad', 'Dokumen harus berformat PDF.'); return; }
  if (f.size > 8 * 1024 * 1024) { toast('bad', 'Ukuran berkas melebihi 8 MB.'); return; }
  const slot = TTD_SLOTS.filter(function (x) { return x.jenis === jenis; })[0]; if (slot && slot.tgl && !g('T')) { toast('bad', 'Tanggal penandatanganan wajib diisi.'); return; }
  loadingBtn(btn, true); const rd = new FileReader();
  rd.onload = function () {
    api('ttd_unggah', { id: p.id, jenis: jenis, tanggal: g('T'), nomor_dok: g('N'), catatan: g('C'), nama: f.name, base64: String(rd.result).split(',')[1] })
      .then(function () { toast('ok', jenis + ' terunggah.'); reloadDetailSoon(p.id); }).catch(function (e) { toast('bad', e.message); loadingBtn(btn, false); });
  };
  rd.onerror = function () { toast('bad', 'Gagal membaca berkas.'); loadingBtn(btn, false); }; rd.readAsDataURL(f);
}
function savePKS(btn) {
  const p = curP(); const v = { id: p.id }; const m = { para_pihak: 'pkPihak', ruang_lingkup: 'pkRuang', masa_berlaku: 'pkMasa', tgl_lapor_gubernur: 'pkLapor', bukti_lapor: 'pkBukti' };
  Object.keys(m).forEach(function (k) { const e = $(m[k]); if (e) v[k] = e.value; });
  loadingBtn(btn, true); api('pks_simpan', v).then(function () { toast('ok', 'PKS disimpan.'); S.dirty = false; reloadDetailSoon(p.id); }).catch(function (e) { toast('bad', e.message); loadingBtn(btn, false); });
}

/* ----------------------------- Berkas ----------------------------- */
function uploadFile(inp) {
  const f = inp.files && inp.files[0]; if (!f) return; const p = curP(); const item = inp.dataset.item;
  const ext = f.name.split('.').pop().toLowerCase(); if (ext !== 'pdf' || (f.type && f.type !== 'application/pdf')) { toast('bad', 'Dokumen harus berformat PDF.'); inp.value = ''; return; }
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
/** Pratinjau berkas (hanya PDF) di jendela dalam aplikasi; berkas diambil lewat berkas_ambil lalu ditampilkan dari blob lokal. */
let viewUrl = null;
function viewFile(id) {
  toast('', 'Membuka berkas…');
  api('berkas_ambil', { id_berkas: id }).then(function (r) {
    const bin = atob(r.base64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    if (viewUrl) URL.revokeObjectURL(viewUrl); viewUrl = URL.createObjectURL(new Blob([arr], { type: r.mime }));
    const img = /^image\//.test(r.mime);
    modal({ title: r.nama, wide: true, hideCancel: true, body: '<div class="viewer">' + (img ? '<img src="' + viewUrl + '" alt="' + esc(r.nama) + '">' : '<iframe src="' + viewUrl + '" title="' + esc(r.nama) + '"></iframe>') + '</div><div style="margin-top:10px"><button type="button" class="btn btn-o btn-s" data-act="dl" data-id="' + esc(id) + '">' + mi('download') + ' Unduh berkas</button></div>' });
  }).catch(function (e) { toast('bad', e.message); });
}
function deleteFile(id) {
  modal({ title: 'Hapus berkas?', body: '<p>Berkas akan dipindahkan ke tempat sampah Drive.</p>', ok: 'Hapus', danger: true, onOk: function () {
    return api('berkas_hapus', { id_berkas: id }).then(function () { const c = S.det[S.params.id]; if (c && c.d) c.d.berkas = c.d.berkas.filter(function (b) { return b.id !== id; }); renderDetailBody(); toast('ok', 'Berkas dihapus.'); });
  } });
}

/* ----------------------------- Admin: pengguna ----------------------------- */
function googleCard() {
  const a = authCfg(); const on = !!a.gid;
  return '<div class="card gcfg" style="margin-bottom:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><h3 style="margin:0">Login dengan Google</h3><p class="sub" style="margin-top:4px">' + (on ? (a.pw ? 'Aktif — mode peralihan: Google <b>dan</b> kata sandi diizinkan.' : 'Aktif — hanya akun Google yang dapat masuk.') : 'Belum aktif. Saat ini pengguna masuk dengan email &amp; kata sandi.') + '</p></div><span class="chip ' + (on ? 'c-ok' : 'c-bad') + '">' + (on ? 'Aktif' : 'Belum aktif') + '</span><button class="btn btn-o" data-act="gAtur">' + mi('settings') + ' ' + (on ? 'Atur' : 'Aktifkan') + '</button></div>';
}
function vUsers() {
  setTitle('Pengguna'); setView('<div class="ph"><div><h2>Manajemen pengguna</h2><p>Kelola akun internal dan mitra.</p></div><div class="sp"></div><button class="btn btn-p" data-act="addUser">' + mi('person_add') + ' Tambah pengguna</button></div><div id="uCfg">' + googleCard() + '</div><div id="uBody">' + skel() + '</div>');
  const draw = function () {
    $('uCfg').innerHTML = googleCard();
    $('uBody').innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Lembaga</th><th>Jenis mitra / wilayah</th><th>Status</th><th></th></tr></thead><tbody>' + S.users.map(function (u) {
      const id = esc(u.id), me = S.me && u.id === S.me.id;
      return '<tr style="cursor:default"><td class="t-b">' + esc(u.nama) + '</td><td>' + esc(u.email) + '</td><td>' + esc(u.peran_nama) + '</td><td>' + esc(u.lembaga) + '</td><td>' + (u.peran === 'mitra' ? (u.jenis_mitra ? esc(jenisNama(u.jenis_mitra)) : '<span class="hint">Belum diatur</span>') : (['admin', 'uptd'].indexOf(u.peran) > -1 ? esc(u.wilayah_nama || 'Semua wilayah') : '-')) + '</td><td><span class="chip ' + (u.aktif ? 'c-ok' : 'c-bad') + '">' + (u.aktif ? 'Aktif' : 'Nonaktif') + '</span></td><td style="white-space:nowrap"><button class="btn btn-o btn-s" data-act="editUser" data-id="' + id + '">Ubah</button> ' +
        (me ? '' : '<button class="btn btn-o btn-s" data-act="toggleUser" data-id="' + id + '">' + (u.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button> ') +
        (googleOnlyUI() ? '' : '<button class="btn btn-o btn-s" data-act="resetUser" data-id="' + id + '">Reset sandi</button> ') +
        (u.peran === 'mitra' && !me ? '<button class="btn btn-o btn-s" style="color:var(--bad,#b3261e)" data-act="delUser" data-id="' + id + '">' + mi('delete') + ' Hapus</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  };
  if (S.users) draw(); api('daftar_user').then(function (u) { S.users = u; if (S.view === 'users') draw(); }).catch(function (e) { toast('bad', e.message); });
}
function wilFld(id, sel) {
  return '<div class="fld"><label>Wilayah UPTD</label><select class="in" id="' + id + '"><option value="">Semua wilayah</option>' + ((S.master && S.master.wilayah) || []).map(function (w) { return '<option value="' + esc(w.kode) + '"' + (w.kode === sel ? ' selected' : '') + '>' + esc(w.nama) + '</option>'; }).join('') + '</select><p class="hint">Admin/UPTD hanya melihat pengajuan dari wilayahnya. Kosongkan untuk melihat semua wilayah.</p></div>';
}
function jenisOpts(sel) { return '<option value="">— Pilih jenis mitra —</option>' + ((S.master && S.master.jenis) || []).map(function (j) { return '<option value="' + esc(j.kode) + '"' + (j.kode === sel ? ' selected' : '') + '>' + esc(j.nama) + '</option>'; }).join(''); }
function editUser(u) {
  const mitra = u.peran === 'mitra';
  modal({ title: 'Ubah pengguna', sub: esc(u.email), body: '<div class="fld"><label>Nama <i>*</i></label><input class="in" id="euN" value="' + esc(u.nama) + '"></div><div class="fld"><label>Email' + (googleOnlyUI() ? ' Google' : '') + '</label><input class="in" type="email" id="euE" value="' + esc(u.email) + '"></div><div class="row2"><div class="fld"><label>Lembaga</label><input class="in" id="euL" value="' + esc(u.lembaga) + '"></div><div class="fld"><label>Jabatan</label><input class="in" id="euJ" value="' + esc(u.jabatan) + '"></div></div><div class="row2"><div class="fld"><label>Telepon / WhatsApp</label><input class="in" id="euT" value="' + esc(u.telepon) + '"></div>' + (mitra ? '<div class="fld"><label>Jenis mitra</label><select class="in" id="euM">' + jenisOpts(u.jenis_mitra) + '</select></div>' : '') + '</div>' + (mitra ? '<p class="hint">Jenis mitra menentukan daftar dokumen persyaratan. Pengajuan yang masih tahap 1 ikut diperbarui.</p>' : '') + (['admin', 'uptd'].indexOf(u.peran) > -1 ? wilFld('euW', u.wilayah) : ''), ok: 'Simpan', onOk: function () {
    const d = { id: u.id, nama: $('euN').value, email: $('euE').value, lembaga: $('euL').value, jabatan: $('euJ').value, telepon: $('euT').value }; if (mitra) d.jenis_mitra = $('euM').value; if ($('euW')) d.wilayah = $('euW').value;
    return api('ubah_user', d).then(function (r) { Object.assign(u, r.user); if (S.view === 'users') vUsers(); toast('ok', 'Data pengguna disimpan.'); });
  } });
}
function delUser(u) {
  api('hapus_user_info', { id: u.id }).then(function (i) {
    modal({ title: 'Hapus akun mitra?', danger: true, ok: 'Hapus permanen', body: '<p>Akun <b>' + esc(i.email) + '</b> (' + esc(i.nama) + (i.lembaga ? ', ' + esc(i.lembaga) : '') + ') akan dihapus <b>beserta seluruh datanya</b>:</p><ul style="margin:8px 0 8px 18px"><li>' + i.pengajuan + ' pengajuan beserta riwayat, telaah, area peta, dan monev</li><li>' + i.berkas + ' berkas unggahan (dipindah ke Sampah Drive, dapat dipulihkan 30 hari)</li>' + ((i.ba_resmi || i.pks_resmi) ? '<li><b>' + i.ba_resmi + ' Berita Acara disahkan &amp; ' + i.pks_resmi + ' PKS ditandatangani</b> — kodenya tidak dapat diverifikasi lagi</li>' : '') + '</ul><p><b>Tindakan ini tidak dapat dibatalkan.</b> Bila hanya ingin menutup akses, gunakan <i>Nonaktifkan</i>.</p><div class="fld" style="margin-top:10px"><label>Ketik email akun untuk konfirmasi</label><input class="in" id="duK" autocomplete="off" placeholder="' + esc(i.email) + '"></div>', onOk: function () {
      const k = $('duK').value.trim(); if (k.toLowerCase() !== String(u.email).toLowerCase()) return Promise.reject(new Error('Ketik email akun persis seperti yang tertera.'));
      return api('hapus_user', { id: u.id, konfirmasi: k }).then(function () { S.users = (S.users || []).filter(function (x) { return x.id !== u.id; }); S.list = null; if (S.view === 'users') vUsers(); toast('ok', 'Akun mitra dan seluruh datanya dihapus.'); });
    } });
  }).catch(function (e) { toast('bad', e.message); });
}
function gAtur() {
  api('google_status').then(function (g) {
    const org = location.origin;
    modal({ title: 'Login dengan Google', sub: 'Aktifkan masuk memakai akun Google', body:
      '<ol class="steps" style="margin:0 0 12px 18px;line-height:1.6"><li>Buka <b>console.cloud.google.com</b> &rarr; <i>APIs &amp; Services</i> &rarr; <i>OAuth consent screen</i> (jenis External, isi nama aplikasi &amp; email).</li><li><i>Credentials</i> &rarr; <i>Create credentials</i> &rarr; <i>OAuth client ID</i> &rarr; jenis <b>Web application</b>.</li><li>Pada <i>Authorized JavaScript origins</i> isi: <b style="user-select:all">' + esc(org) + '</b></li><li>Salin <b>Client ID</b> ke kolom di bawah, isi email Google Anda sebagai Admin, lalu simpan.</li></ol>' +
      '<div class="fld"><label>Client ID</label><input class="in" id="gaC" value="' + esc(g.client_id) + '" placeholder="1234567890-abc.apps.googleusercontent.com"></div><div class="fld"><label>Email Google Admin (yang Anda pakai untuk masuk)</label><input class="in" type="email" id="gaE" value="' + esc(/\.local$/.test(g.email_admin) ? '' : g.email_admin) + '"></div>' +
      '<div class="fld"><label>Mode</label><select class="in" id="gaM"><option value="0"' + (g.hanya_google ? '' : ' selected') + '>Peralihan — Google dan kata sandi sama-sama boleh</option><option value="1"' + (g.hanya_google ? ' selected' : '') + '>Hanya Google (kata sandi dimatikan)</option></select></div>' +
      '<p class="hint">Disarankan: simpan dengan mode Peralihan, <b>keluar</b>, masuk sebagai Admin lewat tombol Google, lalu kembali ke sini untuk memilih &ldquo;Hanya Google&rdquo;. Ini mencegah Anda terkunci. Kosongkan Client ID untuk mematikan login Google. Semua staf dan mitra perlu memakai email Google.</p>', ok: 'Simpan', onOk: function () {
      return api('google_atur', { client_id: $('gaC').value, email_admin: $('gaE').value, hanya_google: $('gaM').value === '1' }).then(function (r) {
        S.master.config = Object.assign({}, S.master.config, { google_client_id: r.client_id, password_login: r.password_login }); persist(); S.users = null;
        if (r.email_admin && S.me) { S.me.email = r.email_admin; renderNav(); }
        if (S.view === 'users') vUsers(); toast('ok', r.aktif ? 'Login Google disimpan.' : 'Login Google dimatikan.');
      });
    } });
  }).catch(function (e) { toast('bad', e.message); });
}
function showPw(title, user, pw) { modal({ title: title, body: '<p>Akun: <b>' + esc(user.email) + '</b></p><p style="margin-top:8px">Kata sandi sementara:</p><div class="card" style="font-family:monospace;font-size:18px;text-align:center;padding:12px;margin-top:6px;user-select:all">' + esc(pw) + '</div><p class="hint" style="margin-top:8px">Catat sekarang; kata sandi tidak ditampilkan lagi.</p>', hideCancel: true }); }
function addUser() {
  const roles = [['prl', 'Tim Bidang PRL'], ['uptd', 'UPTD Pengelola Kawasan'], ['kepala_dkp', 'Kepala Dinas'], ['admin', 'Admin (UPTD) — validasi & unggah TTD'], ['superadmin', 'Super Admin'], ['mitra', 'Mitra']];
  modal({ title: 'Tambah pengguna', body: '<div class="fld"><label>Nama <i>*</i></label><input class="in" id="auN"></div><div class="fld"><label>' + (googleOnlyUI() ? 'Email Google' : 'Email') + ' <i>*</i></label><input class="in" type="email" id="auE"></div><div class="row2"><div class="fld"><label>Peran <i>*</i></label><select class="in" id="auR">' + roles.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + '</option>'; }).join('') + '</select></div><div class="fld"><label>Lembaga</label><input class="in" id="auL"></div></div><div class="fld"><label>Telepon / WhatsApp</label><input class="in" id="auT" inputmode="tel" placeholder="mis. 081234567890"><div class="hint">Dipakai untuk kiriman jadwal pemaparan lewat WhatsApp (wajib diisi untuk Admin UPTD).</div></div>' + wilFld('auW', '') + '<p class="hint">Wilayah hanya berlaku untuk peran Admin (UPTD) dan UPTD. Buat satu akun Admin untuk tiap wilayah.</p>', ok: 'Buat akun', onOk: function () {
    return api('buat_user', { nama: $('auN').value, email: $('auE').value, peran: $('auR').value, lembaga: $('auL').value, telepon: $('auT').value, wilayah: $('auW').value }).then(function (r) { S.users = null; setTimeout(function () { if (r.password) showPw('Akun dibuat', r.user, r.password); else modal({ title: 'Akun dibuat', body: '<p>Pengguna <b>' + esc(r.user.email) + '</b> dapat langsung masuk dengan tombol <b>Masuk dengan Google</b> memakai akun Google tersebut. Tidak ada kata sandi yang perlu dibagikan.</p>', ok: 'Mengerti', hideCancel: true, onOk: function () { closeModal(); } }); if (S.view === 'users') vUsers(); }, 50); });
  } });
}

/* ----------------------------- Admin: data master ----------------------------- */
function vMaster() {
  setTitle('Data Master'); const m = S.master;
  setView('<div class="ph"><div><h2>Data master</h2><p>Kawasan, persyaratan per jenis mitra, dan kontak bantuan.</p></div><div class="sp"></div><button class="btn btn-p" data-act="saveMaster">' + mi('save') + ' Simpan semua</button></div>' +
    '<div class="card" style="margin-bottom:16px"><h3>Kawasan konservasi</h3><p class="sub">Satu baris per kawasan. Format: <code>Nama | Dasar hukum | Zona1; Zona2</code></p><textarea class="in" id="mKaw" rows="6">' + esc(m.kawasan.map(function (k) { return k.nama + ' | ' + (k.dasar || '') + ' | ' + k.zona.join('; '); }).join('\n')) + '</textarea></div>' +
    '<div class="card" style="margin-bottom:16px"><h3>Wilayah UPTD</h3><p class="sub">Mitra memilih wilayah tempat kegiatan; pengajuan ditangani Admin/UPTD wilayah tersebut. Ubah nama dan cakupan sesuai wilayah kerja. Kode (W1, W2, …) tetap dan tidak dapat dihapus selama masih dipakai.</p><div id="wilList">' + ((m.wilayah || []).map(wilRow).join('')) + '</div><button type="button" class="btn btn-o btn-s" data-act="wilAdd">' + mi('add') + ' Tambah wilayah</button></div>' +
    '<div class="card" style="margin-bottom:16px"><h3>Program Dinas yang ditawarkan ke mitra</h3><p class="sub">Satu program per baris. Format: <code>Nama program | Deskripsi singkat</code>. Tambahkan <code>| nonaktif</code> di akhir baris untuk menyembunyikan dari pilihan mitra tanpa menghapus riwayatnya.</p><textarea class="in" id="mProg" rows="12">' + esc(progLinesText()) + '</textarea></div>' +
    '<div class="card" style="margin-bottom:16px"><h3>Persyaratan per jenis mitra</h3><p class="sub">Satu persyaratan per baris.</p>' + m.jenis.map(function (j) { return '<div class="fld"><label>' + esc(j.nama) + '</label><textarea class="in" rows="3" data-mj="' + esc(j.kode) + '">' + esc((m.persyaratan[j.kode] || []).join('\n')) + '</textarea></div>'; }).join('') + '</div>' +
    ntfCardHtml() + batasCardHtml() + warnaCardHtml() + arcCardHtml() + '<div class="card"><h3>Layanan bantuan</h3><div class="row2"><div class="fld"><label>Email</label><input class="in" id="mHE" value="' + esc((m.config || {}).helpdesk_email || '') + '"></div><div class="fld"><label>Telepon</label><input class="in" id="mHT" value="' + esc((m.config || {}).helpdesk_telp || '') + '"></div></div><div class="fld"><label>WhatsApp Super Admin</label><input class="in" id="mWA" inputmode="tel" placeholder="mis. 081234567890" value="' + esc((m.config || {}).wa_superadmin || '') + '"><div class="hint">Mitra yang selesai mendaftar langsung diarahkan ke nomor ini.</div></div></div>');
  fillBatas(); loadNtf();
}
/** Baris: "Nama | Deskripsi | nonaktif(opsional)". Id lama dipertahankan bila nama sama. */
function wilRow(w) { return '<div class="wil-row" data-kode="' + esc(w.kode || '') + '"><span class="chip c-draft" style="min-width:44px;text-align:center">' + esc(w.kode || 'baru') + '</span><input class="in" data-wn placeholder="Nama wilayah UPTD" value="' + esc(w.nama || '') + '"><input class="in" data-wc placeholder="Cakupan (kabupaten/kecamatan)" value="' + esc(w.cakupan || '') + '"></div>'; }
function wilParse() { return Array.prototype.map.call(document.querySelectorAll('#wilList .wil-row'), function (r) { return { kode: r.dataset.kode, nama: r.querySelector('[data-wn]').value, cakupan: r.querySelector('[data-wc]').value }; }); }
function progLinesText() { return ((S.master && S.master.program) || []).map(function (x) { return x.nama + ' | ' + (x.deskripsi || '') + (x.aktif ? '' : ' | nonaktif'); }).join('\n'); }
function progLinesParse() {
  const lama = {}; ((S.master && S.master.program) || []).forEach(function (x) { lama[x.nama.trim().toLowerCase()] = x.id; });
  return $('mProg').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
    const p = l.split('|'); const nama = (p[0] || '').trim(); return { id: lama[nama.toLowerCase()] || '', nama: nama, deskripsi: (p[1] || '').trim(), aktif: !/^\s*nonaktif\s*$/i.test(p[2] || '') };
  });
}
function saveMaster(btn) {
  const kaw = $('mKaw').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { const p = l.split('|'); return { nama: (p[0] || '').trim(), dasar: (p[1] || '').trim(), zona: (p[2] || '').split(';').map(function (z) { return z.trim(); }).filter(Boolean) }; });
  const per = {}; document.querySelectorAll('[data-mj]').forEach(function (t) { per[t.dataset.mj] = t.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); });
  loadingBtn(btn, true); api('master_simpan', { kawasan: kaw, persyaratan: per, config: { helpdesk_email: $('mHE').value, helpdesk_telp: $('mHT').value, wa_superadmin: $('mWA').value, arcgis_layers: Array.prototype.map.call(document.querySelectorAll('#arcList .arc-row'), function (r) { return { nama: r.querySelector('[data-an]').value, url: r.querySelector('[data-au]').value, kolom: r.querySelector('[data-ak]').value }; }).filter(function (l) { return l.nama.trim() || l.url.trim(); }) } }).then(function (m) { S.master = m; return api('wilayah_simpan', { wilayah: wilParse() }).then(function (wl) { S.master.wilayah = wl; return api('program_simpan', { programs: progLinesParse() }); }).then(function (pr) { S.master.program = pr; persist(); toast('ok', 'Data master tersimpan.'); }); }).catch(function (e) { toast('bad', e.message); }).then(function () { loadingBtn(btn, false); });
}

/* ----------------------------- Akun ----------------------------- */
function vAkun() {
  setTitle('Pengaturan Akun'); const m = S.me, mitra = m.peran === 'mitra';
  setView('<div class="ph"><div><h2>Pengaturan akun</h2></div></div><div class="grid g2"><div class="card"><h3>Profil</h3><div class="fld" style="margin-top:10px"><label>Email</label><input class="in" value="' + esc(m.email) + '" disabled></div><div class="fld"><label>Peran</label><input class="in" value="' + esc(m.peran_nama) + '" disabled></div><div class="fld"><label>Nama <i>*</i></label><input class="in" id="pkN" value="' + esc(m.nama) + '"></div>' +
    (mitra ? '<div class="fld"><label>Lembaga <i>*</i></label><input class="in" id="pkL" value="' + esc(m.lembaga) + '"></div><div class="fld"><label>Jenis mitra <i>*</i></label><select class="in" id="pkM">' + jenisOpts(m.jenis_mitra) + '</select><p class="hint">Menentukan dokumen persyaratan yang harus diunggah. Tidak dapat diubah setelah ada pengajuan yang diproses.</p></div>' : '') +
    '<div class="row2"><div class="fld"><label>Jabatan</label><input class="in" id="pkJ" value="' + esc(m.jabatan) + '"></div><div class="fld"><label>Telepon / WhatsApp</label><input class="in" id="pkT" value="' + esc(m.telepon) + '"></div></div><button class="btn btn-p" data-act="saveProfil">Simpan profil</button></div>' +
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
CHG.warna = function (t) { const c = S.master.config = S.master.config || {}; c.warna_kategori = Object.assign({}, c.warna_kategori); c.warna_kategori[t.dataset.kat.trim().toLowerCase()] = t.value; simpanWarna(); fillWarna(); };
CHG.progDinas = function (t) {
  const d = S.wiz.data; const pd = (S.master.program || []).filter(function (x) { return x.id === t.dataset.id; })[0]; if (!pd) return;
  const rest = progList(d).filter(function (x) { return !(x.jenis === 'dinas' && x.id_program === pd.id); });
  d.programs = t.checked ? progList(d).filter(function (x) { return !(x.jenis === 'dinas' && x.id_program === pd.id); }).concat([{ jenis: 'dinas', id_program: pd.id, nama: pd.nama, keterangan: '' }]) : rest;
  if (!S.wiz.editId) LS.set('sm_form', d);
};
CHG.progNama = function (t) { const own = progList(S.wiz.data).filter(function (x) { return x.jenis === 'mandiri'; })[+t.dataset.i]; if (own) { own.nama = t.value; if (!S.wiz.editId) LS.set('sm_form', S.wiz.data); } };
CHG.progKet = function (t) { const own = progList(S.wiz.data).filter(function (x) { return x.jenis === 'mandiri'; })[+t.dataset.i]; if (own) { own.keterangan = t.value; if (!S.wiz.editId) LS.set('sm_form', S.wiz.data); } };
const ACT = {
  pfBatal: function () { S._gcredReg = null; showAuthTab(S._authTab || 'login'); },
  gRetry: function () { applyAuthMode(); },
  'auth-tab': function (el) { showAuthTab(el.dataset.v); },
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
  gotoTab: function (el) { S.tab = el.dataset.tab; renderDetailBody(); },
  saveJadwal: function (el) {
    const p = curP(), d = ensureDet(); if (!d) return; const v = { id: p.id, tanggal: $('jdT').value, jam: $('jdJ').value, jam_selesai: $('jdJ2').value, tempat: $('jdP').value, tautan: $('jdL').value, peserta: $('jdS').value, catatan: $('jdC').value };
    if (!v.tanggal || !v.jam) { toast('bad', 'Tanggal dan jam mulai wajib diisi.'); return; } if (!v.tempat.trim() && !v.tautan.trim()) { toast('bad', 'Isi tempat atau tautan rapat daring.'); return; }
    loadingBtn(el, true); api('jadwal_simpan', v).then(function (r) { d.jadwal = r; renderDetailBody(); toast('ok', 'Jadwal pemaparan disimpan.'); waHasil(r.wa); }).catch(function (e) { toast('bad', e.message); loadingBtn(el, false); });
  },
  batalJadwal: function () { const p = curP(), d = ensureDet(); modal({ title: 'Batalkan jadwal pemaparan?', body: '<p>Mitra akan diberi tahu. Pemaparan tidak dapat ditandai selesai sebelum jadwal baru ditetapkan.</p>', ok: 'Batalkan jadwal', danger: true, onOk: function () { return api('jadwal_simpan', { id: p.id, batalkan: true }).then(function (r) { d.jadwal = r; renderDetailBody(); toast('ok', 'Jadwal dibatalkan.'); waHasil(r.wa); }); } }); },
  saveCk: saveChecklist, saveTp: saveTelaahProgram, saveTb: saveTelaahBiaya, saveMv: saveMonev,
  wilAdd: function () { $('wilList').insertAdjacentHTML('beforeend', wilRow({})); }, progAdd: function () { const d = S.wiz.data; d.programs = progList(d).concat([{ jenis: 'mandiri', id_program: '', nama: '', keterangan: '' }]); if (!S.wiz.editId) LS.set('sm_form', d); renderWiz(); },
  progDel: function (el) { const d = S.wiz.data; const own = progList(d).filter(function (x) { return x.jenis === 'mandiri'; })[+el.dataset.i]; d.programs = progList(d).filter(function (x) { return x !== own; }); if (!S.wiz.editId) LS.set('sm_form', d); renderWiz(); },
  ttdUp: function (el) { ttdUpload(el, el.dataset.j); }, savePks: function (el) { savePKS(el); },
  dl: function (el, e) { e.preventDefault(); downloadFile(el.dataset.id); }, view: function (el, e) { e.preventDefault(); viewFile(el.dataset.id); }, delFile: function (el) { deleteFile(el.dataset.id); },
  addUser: addUser, saveMaster: saveMaster, gAtur: gAtur,
  editUser: function (el) { const u = S.users.filter(function (x) { return x.id === el.dataset.id; })[0]; if (u) editUser(u); },
  delUser: function (el) { const u = S.users.filter(function (x) { return x.id === el.dataset.id; })[0]; if (u) delUser(u); },
  saveProfil: function (el) {
    const d = { nama: $('pkN').value, jabatan: $('pkJ').value, telepon: $('pkT').value }; if ($('pkM')) { d.jenis_mitra = $('pkM').value; d.lembaga = $('pkL').value; }
    if (!d.nama.trim()) { toast('bad', 'Nama wajib diisi.'); return; } if ($('pkM') && !d.jenis_mitra) { toast('bad', 'Pilih jenis mitra.'); return; }
    loadingBtn(el, true); api('profil_simpan', d).then(function (u) { Object.assign(S.me, u); S.list = null; persist(); renderNav(); toast('ok', 'Profil disimpan.'); }).catch(function (e) { toast('bad', e.message); }).then(function () { loadingBtn(el, false); });
  },
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

/* ----------------------------- Super Admin: notifikasi WhatsApp & Email (antrean) ----------------------------- */
function ntfCardHtml() { return '<div class="card" style="margin-bottom:16px" id="ntfCard"><h3>Notifikasi WhatsApp &amp; Email</h3><p class="sub">Pesan masuk antrean lalu dikirim otomatis tiap menit, sehingga aplikasi tidak menunggu.</p><div id="ntfBody"><div class="hint">Memuat…</div></div></div>'; }
function loadNtf() { api('notif_status').then(renderNtf).catch(function (e) { const b = $('ntfBody'); if (b) b.innerHTML = '<div class="errtxt">' + esc(e.message) + '</div>'; }); }
function renderNtf(s) {
  const b = $('ntfBody'); if (!b) return; S.ntf = s;
  const ev = s.events.map(function (e) { return '<tr><td>' + esc(e.label) + '</td><td style="text-align:center"><input type="checkbox" data-ntw="' + e.kode + '"' + (e.wa ? ' checked' : '') + '></td><td style="text-align:center"><input type="checkbox" data-nte="' + e.kode + '"' + (e.email ? ' checked' : '') + '></td></tr>'; }).join('');
  const rec = s.terbaru.map(function (r) { return '<tr><td>' + esc(r.kanal) + '</td><td>' + esc(r.tujuan) + '</td><td>' + esc(r.event) + '</td><td><span class="chip ' + (r.status === 'Terkirim' ? 'c-ok' : r.status === 'Gagal' ? 'c-bad' : 'c-draft') + '">' + esc(r.status) + '</span></td><td class="t-sub">' + esc(r.respon || '') + '</td></tr>'; }).join('');
  b.innerHTML = '<div class="row2"><label class="tick"><input type="checkbox" id="ntWa"' + (s.wa_aktif ? ' checked' : '') + '> WhatsApp aktif</label><label class="tick"><input type="checkbox" id="ntEm"' + (s.email_aktif ? ' checked' : '') + '> Email aktif</label></div>' +
    '<div class="fld" style="margin-top:10px"><label>Token Fonnte ' + (s.token_ada ? '<span class="chip c-ok">tersimpan</span>' : '<span class="chip c-bad">belum diisi</span>') + '</label><input class="in" id="ntTok" type="password" autocomplete="off" placeholder="' + (s.token_ada ? esc(s.token_samar) + ' (kosongkan bila tidak diganti)' : 'Tempel token dari fonnte.com') + '"><div class="hint">Token disimpan di server (Script Properties), tidak pernah dikirim kembali ke layar ini.' + (s.token_ada ? ' <a href="#" data-act="ntHapus">Hapus token</a>' : '') + '</div></div>' +
    '<div class="tblwrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Kejadian</th><th style="text-align:center">WA</th><th style="text-align:center">Email</th></tr></thead><tbody>' + ev + '</tbody></table></div>' +
    '<div class="btns" style="margin-top:10px"><button class="btn btn-p btn-s" data-act="ntSimpan">Simpan pengaturan</button><button class="btn btn-o btn-s" data-act="ntProses">Proses antrean sekarang</button><button class="btn btn-o btn-s" data-act="ntUlang">Kirim ulang yang gagal</button><button class="btn btn-o btn-s" data-act="ntUji">Kirim pesan uji WA</button></div>' +
    '<p class="sub" style="margin-top:10px">Antrean: <b>' + s.hitung.Antri + '</b> menunggu · <b>' + s.hitung.Terkirim + '</b> terkirim · <b>' + s.hitung.Gagal + '</b> gagal</p>' +
    (rec ? '<div class="tblwrap"><table class="tbl"><thead><tr><th>Kanal</th><th>Tujuan</th><th>Kejadian</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>' + rec + '</tbody></table></div>' : '<div class="hint">Belum ada pesan di antrean.</div>');
}
function ntfSimpanBody(extra) {
  const m = {}; document.querySelectorAll('[data-ntw]').forEach(function (c) { m[c.dataset.ntw] = { wa: c.checked, email: false }; });
  document.querySelectorAll('[data-nte]').forEach(function (c) { (m[c.dataset.nte] = m[c.dataset.nte] || { wa: false }).email = c.checked; });
  return Object.assign({ wa_aktif: $('ntWa').checked, email_aktif: $('ntEm').checked, token: $('ntTok').value, matriks: m }, extra || {});
}
Object.assign(ACT, {
  ntSimpan: function (el) { loadingBtn(el, true); api('notif_simpan', ntfSimpanBody()).then(function (s) { toast('ok', 'Pengaturan notifikasi disimpan.'); renderNtf(s); }).catch(function (e) { toast('bad', e.message); }).then(function () { loadingBtn(el, false); }); },
  ntProses: function (el) { loadingBtn(el, true); api('notif_proses', {}).then(function (s) { toast('ok', s.sibuk ? 'Antrean sedang diproses pemicu, coba lagi sebentar.' : 'Diproses: ' + s.diproses + ' pesan.'); renderNtf(s); }).catch(function (e) { toast('bad', e.message); }).then(function () { loadingBtn(el, false); }); },
  ntUlang: function (el) { loadingBtn(el, true); api('notif_proses', { ulang: true }).then(function (s) { toast('ok', 'Pesan gagal dikirim ulang: ' + s.diproses + ' diproses.'); renderNtf(s); }).catch(function (e) { toast('bad', e.message); }).then(function () { loadingBtn(el, false); }); },
  ntHapus: function () { if (!confirm('Hapus token Fonnte? Pengiriman otomatis berhenti dan kembali ke tombol WhatsApp manual.')) return; api('notif_simpan', { hapus_token: true }).then(function (s) { toast('ok', 'Token dihapus.'); renderNtf(s); }).catch(function (e) { toast('bad', e.message); }); },
  ntUji: function (el) {
    modal({ title: 'Kirim pesan uji WhatsApp', body: '<div class="fld"><label>Nomor tujuan</label><input class="in" id="ntNo" inputmode="tel" placeholder="mis. 081234567890"></div><p class="hint">Pesan uji dimasukkan ke antrean lalu langsung diproses.</p>', ok: 'Kirim uji', onOk: function () { return api('notif_proses', { uji: $('ntNo').value }).then(function (s) { renderNtf(s); const t = s.terbaru[0]; toast(t && t.status === 'Terkirim' ? 'ok' : 'bad', t ? 'Hasil uji: ' + t.status + (t.respon ? ' (' + t.respon + ')' : '') : 'Tidak ada hasil.'); }); } });
  }
});
