/* =====================================================================
 * Klien REST untuk Google Apps Script (GAS-PRO-API)
 * - POST memakai Content-Type text/plain  → tidak memicu CORS preflight (GAS tidak menanganinya)
 * - Token sesi dikirim di body, bukan di header/URL
 * - Deduplikasi permintaan baca yang sedang berjalan + 1x retry khusus baca
 * - Timeout, pesan galat ramah, logout otomatis saat sesi habis
 * ===================================================================== */
'use strict';
const READ_ACTIONS = /^(me|boot|daftar|detail|master|daftar_user|berkas_ambil)$/;
const inflight = {};
let writeEpoch = 0;

function apiUrl() {
  const u = (window.SIMITRA_CONFIG && window.SIMITRA_CONFIG.API_URL) || '';
  if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec/.test(u) && !/^http:\/\/(127\.0\.0\.1|localhost)/.test(u)) throw new Error('API_URL belum diisi. Edit js/config.js dengan URL Web App (/exec).');
  return u;
}
function netError(e) {
  if (e && e.name === 'AbortError') return new Error('Server tidak merespons (timeout). Coba lagi sebentar.');
  if (e instanceof SyntaxError) return new Error('Respons server tidak valid. Pastikan deployment Web App diatur "Siapa saja" dan memakai versi terbaru.');
  if (e && e.code) return e;
  return new Error(e && e.message && !/Failed to fetch|NetworkError|Load failed/i.test(e.message) ? e.message : 'Tidak dapat terhubung ke server. Periksa koneksi internet.');
}
async function rawFetch(url, opts) {
  const ctl = new AbortController(); const t = setTimeout(function () { ctl.abort(); }, (window.SIMITRA_CONFIG && window.SIMITRA_CONFIG.TIMEOUT_MS) || 45000);
  try { const res = await fetch(url, Object.assign({ signal: ctl.signal, redirect: 'follow' }, opts)); return await res.json(); }
  finally { clearTimeout(t); }
}
function unwrap(r) {
  if (r && r.success) return r.data;
  const e = new Error((r && r.message) || 'Permintaan gagal.'); e.code = r && r.code;
  if (e.code === 'AUTH' && S.token) forceLogout(e.message);
  throw e;
}
async function doPostOnce(action, data) {
  return unwrap(await rawFetch(apiUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, data: data || {}, token: S.token }) }));
}
async function runApi(action, data, retry) {
  try { return await doPostOnce(action, data); }
  catch (e) {
    if (retry && !e.code) { await new Promise(function (r) { setTimeout(r, 800); }); try { return await doPostOnce(action, data); } catch (e2) { throw netError(e2); } }
    throw netError(e);
  }
}
/** POST ke GAS. Baca: dedupe + retry. Tulis: menaikkan epoch sehingga baca berikutnya tidak menumpang hasil lama. */
function api(action, data) {
  if (!READ_ACTIONS.test(action)) { writeEpoch++; return runApi(action, data, false); }
  const k = writeEpoch + '|' + action + '|' + JSON.stringify(data || {});
  if (inflight[k]) return inflight[k];
  const p = runApi(action, data, true); inflight[k] = p;
  p.then(function () { delete inflight[k]; }, function () { delete inflight[k]; });
  return p;
}
/** GET publik (tanpa token), mis. data master untuk halaman login. */
async function apiGet(action) {
  const u = apiUrl() + (apiUrl().indexOf('?') > -1 ? '&' : '?') + 'action=' + encodeURIComponent(action);
  try { return unwrap(await rawFetch(u, { method: 'GET' })); } catch (e) { throw netError(e); }
}
