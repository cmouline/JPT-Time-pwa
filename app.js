(() => {
const $ = s => document.querySelector(s);
const KEY = 'pointage-v1';
const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const pad = n => String(n).padStart(2, '0');
const mins = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function fresh() {
  return { entries: [], schedule: DAYS.map(() => ({ in: '09:00', out: '17:15' })), lastCredit: 0 };
}
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.entries)) return Object.assign(fresh(), d); } catch (e) {}
  return fresh();
}
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert('Sauvegarde impossible (stockage plein ou bloqué).'); } };

// Delta en minutes : arrivée en avance = +, sortie en retard = +
function delta(e) {
  const d = new Date(e.ts);
  const act = d.getHours() * 60 + d.getMinutes();
  const ref = mins(e.ref);
  return e.type === 'in' ? ref - act : act - ref;
}
function fmtRow(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }
function fmtTot(n) {
  const s = n < 0 ? '−' : '+', a = Math.abs(n), h = Math.floor(a / 60), m = a % 60;
  return h ? `${s}${h}h${pad(m)}` : `${s}${m}mn`;
}
const cls = n => n < 0 ? 'neg' : 'pos';
const fmtDate = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const toDateInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

let tab = 'cur', editMode = false, F = null;

function show(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id));
  window.scrollTo(0, 0);
}

function renderMain() {
  const cur = S.entries.filter(e => !e.archived);
  const total = cur.reduce((a, e) => a + delta(e), 0);
  const t = $('#total');
  t.textContent = fmtTot(total); t.className = 'total ' + cls(total);
  const c = $('#credit');
  c.textContent = 'Crédit du mois dernier : ' + fmtTot(S.lastCredit || 0);
  $('#t-cur').classList.toggle('on', tab === 'cur');
  $('#t-arc').classList.toggle('on', tab === 'arc');
  $('#b-edit').textContent = editMode ? 'OK' : 'Modifier';
  const list = S.entries.filter(e => !!e.archived === (tab === 'arc')).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const box = $('#list');
  if (!list.length) { box.innerHTML = '<div class="empty">Aucun pointage</div>'; return; }
  box.innerHTML = '';
  list.forEach(e => {
    const d = new Date(e.ts), v = delta(e);
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div><div class="t">${e.type === 'in' ? '🛬 Arrivée' : '🛫 Sortie'} à ${toTimeInput(d)}</div><div class="d">${fmtDate(d)}${e.archived ? ' · archivé' : ''}</div></div><div class="v ${cls(v)}">${fmtRow(v)}${editMode ? '<span class="x">✕</span>' : ''}</div>`;
    row.onclick = () => {
      if (editMode) { if (confirm('Supprimer ce pointage ?')) { S.entries = S.entries.filter(x => x.id !== e.id); save(); renderMain(); } }
      else openForm(e);
    };
    box.appendChild(row);
  });
}

// ---------- Formulaire ----------
function refFor(date) { return S.schedule[date.getDay()] || { in: '09:00', out: '17:15' }; }

function openForm(e) {
  const now = new Date();
  if (e) {
    const d = new Date(e.ts);
    F = { id: e.id, type: e.type, date: toDateInput(d), time: toTimeInput(d), rin: e.type === 'in' ? e.ref : refFor(d).in, rout: e.type === 'out' ? e.ref : refFor(d).out, archived: e.archived };
  } else {
    const r = refFor(now);
    F = { id: null, type: 'in', date: toDateInput(now), time: toTimeInput(now), rin: r.in, rout: r.out };
  }
  fillForm(); show('v-form');
}
function fillForm() {
  $('#f-title').textContent = F.id ? 'Modifier le pointage' : 'Ajouter un pointage';
  $('#f-rin').value = F.rin; $('#f-rout').value = F.rout;
  $('#f-date').value = F.date; $('#f-time').value = F.time;
  $('#g-in').classList.toggle('on', F.type === 'in');
  $('#g-out').classList.toggle('on', F.type === 'out');
  $('#f-lbl').textContent = F.type === 'in' ? "Heure d'arrivée" : 'Heure de sortie';
  $('#f-ok').textContent = F.id ? 'Enregistrer' : 'Ajouter';
}
$('#g-in').onclick = () => { F.type = 'in'; fillForm(); };
$('#g-out').onclick = () => { F.type = 'out'; fillForm(); };
$('#f-date').onchange = ev => {
  F.date = ev.target.value;
  if (!F.id && F.date) { const [y, m, d] = F.date.split('-').map(Number); const r = refFor(new Date(y, m - 1, d)); F.rin = r.in; F.rout = r.out; fillForm(); }
};
$('#f-ok').onclick = () => {
  const date = $('#f-date').value, time = $('#f-time').value, rin = $('#f-rin').value, rout = $('#f-rout').value;
  if (!date || !time || !rin || !rout) { alert('Complète tous les champs.'); return; }
  const [y, m, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const ts = new Date(y, m - 1, d, h, mi).toISOString();
  const ref = F.type === 'in' ? rin : rout;
  if (F.id) {
    const e = S.entries.find(x => x.id === F.id);
    Object.assign(e, { type: F.type, ts, ref });
  } else {
    S.entries.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type: F.type, ts, ref, archived: false });
  }
  save(); renderMain(); show('v-main');
};
$('#f-back').onclick = () => show('v-main');

// ---------- Réglages ----------
function renderSettings() {
  const box = $('#s-sched'); box.innerHTML = '';
  [1, 2, 3, 4, 5, 6, 0].forEach(i => {
    const r = document.createElement('div'); r.className = 'wd';
    r.innerHTML = `<span>${DAYS[i]}</span><input type="time" value="${S.schedule[i].in}"><input type="time" value="${S.schedule[i].out}">`;
    const [a, b] = r.querySelectorAll('input');
    a.onchange = () => { if (a.value) { S.schedule[i].in = a.value; save(); } };
    b.onchange = () => { if (b.value) { S.schedule[i].out = b.value; save(); } };
    box.appendChild(r);
  });
  $('#s-credit').value = S.lastCredit || 0;
}
$('#s-credit').onchange = ev => { S.lastCredit = parseInt(ev.target.value, 10) || 0; save(); renderMain(); };
$('#s-arch').onclick = () => {
  const cur = S.entries.filter(e => !e.archived);
  if (!cur.length) { alert('Aucun pointage à archiver.'); return; }
  const total = cur.reduce((a, e) => a + delta(e), 0);
  if (!confirm(`Archiver ${cur.length} pointages (total ${fmtTot(total)}) ? Ce total deviendra le crédit du mois dernier.`)) return;
  cur.forEach(e => e.archived = true);
  S.lastCredit = total; save(); renderMain(); renderSettings(); show('v-main');
};
$('#s-exp').onclick = () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `pointage-${toDateInput(new Date())}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('#s-imp').onclick = () => $('#s-file').click();
$('#s-file').onchange = async ev => {
  const f = ev.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || !Array.isArray(d.entries)) throw new Error();
    if (!confirm('Remplacer les données actuelles par ce fichier ?')) return;
    S = Object.assign(fresh(), d); save(); renderMain(); renderSettings(); show('v-main');
  } catch (e) { alert('Fichier invalide.'); }
  ev.target.value = '';
};
$('#s-del').onclick = () => {
  if (confirm('Effacer toutes les données ? (exporte une sauvegarde avant)')) { S = fresh(); save(); renderMain(); renderSettings(); show('v-main'); }
};
$('#s-back').onclick = () => { renderMain(); show('v-main'); };

// ---------- Navigation ----------
$('#b-add').onclick = () => openForm(null);
$('#b-edit').onclick = () => { editMode = !editMode; renderMain(); };
$('#b-set').onclick = () => { renderSettings(); show('v-set'); };
$('#t-cur').onclick = () => { tab = 'cur'; renderMain(); };
$('#t-arc').onclick = () => { tab = 'arc'; renderMain(); };

renderMain();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
