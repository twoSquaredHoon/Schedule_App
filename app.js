// Phone app: Home (now) -> Switch (where + what) -> Meme (pick one) -> Home.
const $ = (id) => document.getElementById(id);
const { api, clock, esc } = window.LL;

const S = { current: null, places: [], tags: [], place: null, tag: null, entryId: null, memeId: null, timer: null };

// ---------- routing ----------
function show(name) {
  for (const id of ['home', 'switch', 'meme']) $(id).hidden = id !== name;
  window.scrollTo(0, 0);
}
async function route() {
  const name = (location.hash || '#home').slice(1);
  if (name === 'switch') return openSwitch();
  if (name === 'meme' && S.entryId) return openMeme();
  return openHome();
}
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('home').hidden) openHome(); });

async function loadState() {
  const st = await api('/api/state');
  S.current = st.current; S.places = st.places; S.tags = st.tags;
}

// ---------- home ----------
async function openHome() {
  show('home');
  try { await loadState(); } catch (e) { console.error(e); }
  const c = S.current;
  $('nowCard').hidden = !c; $('startCard').hidden = !!c;
  clearInterval(S.timer);
  if (!c) return;
  $('nowTag').textContent = c.tag || '—';
  $('nowPlace').textContent = c.place || '';
  $('nowPlaceRow').hidden = !c.place;
  $('nowImg').hidden = !c.url; $('nowEmpty').hidden = !!c.url;
  if (c.url) $('nowImg').src = c.url;
  const start = new Date(c.started_at).getTime();
  const tick = () => { $('nowClock').textContent = clock(Date.now() - start); };
  tick(); S.timer = setInterval(tick, 1000);
  $('nowCard').setAttribute('aria-label', `${c.tag || ''} ${c.place ? 'at ' + c.place : ''}. Switch`);
}

// ---------- switch ----------
const PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';

async function openSwitch() {
  show('switch');
  clearInterval(S.timer);
  $('switchError').textContent = '';
  try { await loadState(); } catch (e) { $('switchError').textContent = e.message; }
  S.place = S.current ? S.current.place_id : null;
  S.tag = null;
  S.editing = { place: false, tag: false };
  if (!$('sheet').hidden) closeSheet();
  $('placeInput').value = ''; $('tagInput').value = '';
  $('placeInput').placeholder = (S.current && S.current.place) || '';
  $('tagInput').placeholder = (S.current && S.current.tag) || '';
  renderChips('place'); renderChips('tag');
}

const KIND = {
  place: { input: 'placeInput', box: 'placeChips', list: () => S.places, url: '/api/places', label: 'place' },
  tag: { input: 'tagInput', box: 'tagChips', list: () => S.tags, url: '/api/tags', label: 'activity' },
};

const PENCIL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
const PENCIL_SM = '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>';
S.editing = { place: false, tag: false };

function renderChips(kind) {
  const k = KIND[kind];
  const editing = S.editing[kind];
  const filter = $(k.input).value.trim().toLowerCase();
  const items = k.list().filter((x) => !filter || x.name.toLowerCase().includes(filter));
  const box = $(k.box);
  box.innerHTML = items.map((x) => editing
    ? `<button type="button" class="chip editing" data-id="${x.id}" aria-label="Edit ${esc(x.name)}">${esc(x.name)}${PENCIL_SM}</button>`
    : `<button type="button" class="chip" data-id="${x.id}" aria-pressed="${S[kind] === x.id}">${esc(x.name)}</button>`).join('') +
    (editing ? '' : `<button type="button" class="round-add" data-add aria-label="Add ${k.label}">${PLUS}</button>`) +
    (k.list().length ? `<button type="button" class="round-edit" data-edit aria-pressed="${editing}" aria-label="${editing ? 'Done editing' : 'Edit ' + k.label + 's'}">${PENCIL}</button>` : '');
  $('go').disabled = !S.tag;
}

// ---------- edit sheet (rename / delete) ----------
const TRASH = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
const sheet = { kind: null, item: null, armed: false, timer: null };
function openSheet(kind, item) {
  sheet.kind = kind; sheet.item = item;
  $('sheetInput').value = item.name;
  $('sheetError').textContent = '';
  disarm();
  $('sheet').hidden = false;
  setTimeout(() => $('sheetInput').focus(), 50);
}
function closeSheet() { $('sheet').hidden = true; disarm(); sheet.item = null; }
function disarm() {
  sheet.armed = false; clearTimeout(sheet.timer);
  $('sheetDelete').classList.remove('armed');
  $('sheetDelete').innerHTML = TRASH;
  $('sheetDelete').setAttribute('aria-label', 'Delete');
}
async function afterChange(kind) {
  await loadState();
  if (!KIND[kind].list().length) S.editing[kind] = false;
  $('placeInput').placeholder = (S.current && S.current.place) || '';
  $('tagInput').placeholder = (S.current && S.current.tag) || '';
  renderChips(kind);
}
async function saveSheet() {
  const name = $('sheetInput').value.trim();
  if (!name || !sheet.item) return;
  if (name === sheet.item.name) return closeSheet();
  try {
    await api(`${KIND[sheet.kind].url}/${sheet.item.id}`, { method: 'PATCH', json: { name } });
    const kind = sheet.kind; closeSheet(); await afterChange(kind);
  } catch (e) { $('sheetError').textContent = e.message; }
}
async function deleteSheet() {
  if (!sheet.armed) {
    // First tap arms it; a second tap within 3 seconds deletes.
    sheet.armed = true;
    $('sheetDelete').classList.add('armed');
    $('sheetDelete').innerHTML = `${TRASH}<span>Delete?</span>`;
    $('sheetDelete').setAttribute('aria-label', 'Tap again to delete');
    sheet.timer = setTimeout(disarm, 3000);
    return;
  }
  const { kind, item } = sheet;
  try {
    await api(`${KIND[kind].url}/${item.id}`, { method: 'DELETE' });
    if (S[kind] === item.id) S[kind] = null;
    closeSheet(); await afterChange(kind);
  } catch (e) { $('sheetError').textContent = e.message; disarm(); }
}
$('sheetSave').addEventListener('click', saveSheet);
$('sheetDelete').addEventListener('click', deleteSheet);
$('sheetInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveSheet(); } });
$('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });

const adding = { place: false, tag: false };
async function addFromInput(kind) {
  if (adding[kind]) return; // ignore extra taps while one add is still going
  const k = KIND[kind];
  const name = $(k.input).value.trim();
  if (!name) { $(k.input).focus(); return; }
  const existing = k.list().find((x) => x.name.toLowerCase() === name.toLowerCase());
  adding[kind] = true;
  $(k.box).querySelector('[data-add]')?.setAttribute('disabled', '');
  try {
    const item = existing || await api(k.url, { json: { name } });
    // Never show the same place/activity twice.
    if (!k.list().some((x) => x.id === item.id)) k.list().unshift(item);
    S[kind] = item.id;
    $(k.input).value = '';
    $(k.input).blur();
  } catch (e) {
    $('switchError').textContent = e.message;
  } finally {
    adding[kind] = false;
    renderChips(kind);
  }
}

for (const kind of ['place', 'tag']) {
  const k = KIND[kind];
  $(k.input).addEventListener('input', () => renderChips(kind));
  $(k.input).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFromInput(kind); } });
  const box = $(k.box);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-add')) return addFromInput(kind);
    if (b.hasAttribute('data-edit')) { S.editing[kind] = !S.editing[kind]; return renderChips(kind); }
    const id = Number(b.dataset.id);
    if (S.editing[kind]) {
      const item = k.list().find((x) => x.id === id);
      if (item) openSheet(kind, item);
      return;
    }
    S[kind] = S[kind] === id ? null : id;
    renderChips(kind);
  });
}

$('go').addEventListener('click', async () => {
  if (!S.tag) return;
  $('go').disabled = true;
  try {
    const entry = await api('/api/switch', { json: { place_id: S.place, tag_id: S.tag } });
    S.entryId = entry.id;
    S.memeTag = entry.tag_id; S.memeTitle = [entry.tag, entry.place].filter(Boolean).join(' · ');
    location.hash = '#meme';
  } catch (e) {
    $('switchError').textContent = e.message;
    $('go').disabled = false;
  }
});

// ---------- meme ----------
function tileHtml(m) {
  return `<button type="button" class="tile" data-id="${m.id}" aria-pressed="${S.memeId === m.id}" aria-label="Meme ${m.id}"><img src="${m.url}" alt="" loading="lazy"></button>`;
}
async function openMeme() {
  show('meme');
  S.memeId = null;
  $('memeHead').textContent = S.memeTitle || '';
  const addTile = $('restGrid').querySelector('.add');
  $('taggedGrid').innerHTML = ''; $('restGrid').replaceChildren(addTile);
  try {
    const { tagged, rest } = await api(`/api/media?tag_id=${S.memeTag || ''}`);
    $('taggedGrid').innerHTML = tagged.map(tileHtml).join('');
    addTile.insertAdjacentHTML('afterend', rest.map(tileHtml).join(''));
  } catch (e) { console.error(e); }
  syncMemeSections();
}
function syncMemeSections() {
  const has = $('taggedGrid').children.length > 0;
  $('taggedGrid').hidden = !has; $('memeRule').hidden = !has;
}
for (const grid of ['taggedGrid', 'restGrid']) {
  $(grid).addEventListener('click', (e) => {
    const t = e.target.closest('button.tile');
    if (!t) return;
    const id = Number(t.dataset.id);
    S.memeId = S.memeId === id ? null : id;
    document.querySelectorAll('.tile[data-id]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.id) === S.memeId)));
  });
}
$('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const ph = document.createElement('div');
  ph.className = 'tile loading';
  $('taggedGrid').prepend(ph); syncMemeSections();
  const fd = new FormData();
  fd.append('file', file);
  if (S.memeTag) fd.append('tag_id', S.memeTag);
  try {
    const m = await api('/api/media', { method: 'POST', body: fd });
    S.memeId = m.id;
    document.querySelectorAll('.tile[data-id]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    ph.outerHTML = tileHtml(m);
  } catch (err) {
    ph.remove(); syncMemeSections();
    alert(err.message);
  }
});
$('skip').addEventListener('click', () => { S.entryId = null; location.hash = '#home'; });
$('done').addEventListener('click', async () => {
  if (S.entryId && S.memeId) {
    try { await api(`/api/entries/${S.entryId}/media`, { json: { media_id: S.memeId } }); } catch (e) { alert(e.message); return; }
  }
  S.entryId = null;
  location.hash = '#home';
});

route();
