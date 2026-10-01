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
  $('placeInput').value = ''; $('tagInput').value = '';
  $('placeInput').placeholder = (S.current && S.current.place) || '';
  $('tagInput').placeholder = (S.current && S.current.tag) || '';
  renderChips('place'); renderChips('tag');
}

const KIND = {
  place: { input: 'placeInput', box: 'placeChips', list: () => S.places, url: '/api/places', label: 'place' },
  tag: { input: 'tagInput', box: 'tagChips', list: () => S.tags, url: '/api/tags', label: 'activity' },
};

function renderChips(kind) {
  const k = KIND[kind];
  const filter = $(k.input).value.trim().toLowerCase();
  const items = k.list().filter((x) => !filter || x.name.toLowerCase().includes(filter));
  const box = $(k.box);
  box.innerHTML = items.map((x) =>
    `<button type="button" class="chip" data-id="${x.id}" aria-pressed="${S[kind] === x.id}">${esc(x.name)}</button>`).join('') +
    `<button type="button" class="round-add" data-add aria-label="Add ${k.label}">${PLUS}</button>`;
  $('go').disabled = !S.tag;
}

async function addFromInput(kind) {
  const k = KIND[kind];
  const name = $(k.input).value.trim();
  if (!name) { $(k.input).focus(); return; }
  const existing = k.list().find((x) => x.name.toLowerCase() === name.toLowerCase());
  try {
    const item = existing || await api(k.url, { json: { name } });
    if (!existing) k.list().unshift(item);
    S[kind] = item.id;
    $(k.input).value = '';
    $(k.input).blur();
    renderChips(kind);
  } catch (e) { $('switchError').textContent = e.message; }
}

for (const kind of ['place', 'tag']) {
  const k = KIND[kind];
  $(k.input).addEventListener('input', () => renderChips(kind));
  $(k.input).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFromInput(kind); } });
  const box = $(k.box);
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.longpressed) { if (b) delete b.dataset.longpressed; return; }
    if (b.hasAttribute('data-add')) return addFromInput(kind);
    const id = Number(b.dataset.id);
    S[kind] = S[kind] === id ? null : id;
    renderChips(kind);
  });
  // Press and hold a chip to delete it.
  let hold = null;
  box.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button.chip');
    if (!b) return;
    hold = setTimeout(async () => {
      b.dataset.longpressed = '1';
      const item = k.list().find((x) => x.id === Number(b.dataset.id));
      if (!item || !confirm(`Delete "${item.name}"?`)) return;
      await api(`${k.url}/${item.id}`, { method: 'DELETE' });
      if (S[kind] === item.id) S[kind] = null;
      await loadState(); renderChips(kind);
    }, 650);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) box.addEventListener(ev, () => clearTimeout(hold));
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
