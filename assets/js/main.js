'use strict';

const VOTES_PER_DAY = 5;
const LS_VOTED      = 'sb_voted';
const LS_BUDGET     = 'sb_budget';

// ── App state ─────────────────────────────────────────────────────────────────
let allSongs     = [];   // top-10 chart, loaded at boot
let searchQuery  = '';
let searchResults = null; // DB search results, or null when chart is shown
let appleResults  = null; // Apple Music catalogue results, or null

// ── MusicKit ──────────────────────────────────────────────────────────────────
let musicKit = null;

async function initMusicKit() {
  try {
    await new Promise(resolve => {
      if (window.MusicKit) return resolve();
      document.addEventListener('musickitloaded', resolve, { once: true });
    });
    const res = await fetch('/api/apple-music/token');
    if (!res.ok) return;
    const { token } = await res.json();
    musicKit = await MusicKit.configure({
      developerToken: token,
      app: { name: 'SongBubble', build: '1.0.0' },
    });
  } catch (err) {
    console.warn('MusicKit unavailable:', err);
  }
}

async function searchAppleMusic(q) {
  if (!musicKit) return [];
  try {
    const sf  = musicKit.storefrontId || 'us';
    const res = await musicKit.api.music(`/v1/catalog/${sf}/search`, {
      term: q, types: 'songs', limit: 10,
    });
    return res.data.results?.songs?.data ?? [];
  } catch { return []; }
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function loadVoted() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_VOTED));
    if (!raw) return {};
    if (Array.isArray(raw)) return Object.fromEntries(raw.map(id => [String(id), null]));
    return raw;
  } catch { return {}; }
}

function saveVoted(voted) {
  localStorage.setItem(LS_VOTED, JSON.stringify(voted));
}

function loadBudget() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const b = JSON.parse(localStorage.getItem(LS_BUDGET));
    if (b?.day === today) return b;
  } catch { /* fall through */ }
  return { used: 0, day: today };
}

function saveBudget(budget) {
  localStorage.setItem(LS_BUDGET, JSON.stringify(budget));
}

function votesRemaining() {
  return Math.max(0, VOTES_PER_DAY - loadBudget().used);
}

// ── API ───────────────────────────────────────────────────────────────────────
async function fetchSongs() {
  const res = await fetch('/api/songs');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchSongs(q) {
  const res = await fetch(`/api/songs?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postVote(songId) {
  const res = await fetch('/api/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: songId }),
  });
  return { ok: res.ok, status: res.status };
}

async function deleteVote(songId) {
  const res = await fetch('/api/votes', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: songId }),
  });
  return { ok: res.ok };
}

async function fetchMyVotes() {
  try {
    const res = await fetch('/api/votes');
    if (!res.ok) return { voted_today: [], voted_ever: [] };
    const data = await res.json();
    return {
      voted_today: Array.isArray(data.voted_today) ? data.voted_today : [],
      voted_ever:  Array.isArray(data.voted_ever)  ? data.voted_ever  : [],
    };
  } catch { return { voted_today: [], voted_ever: [] }; }
}

function reconcileVotes({ voted_today, voted_ever }) {
  const today    = todayIso();
  const voted    = loadVoted();
  const todaySet = new Set(voted_today.map(String));
  const everSet  = new Set(voted_ever.map(String));

  for (const [id, date] of Object.entries(voted)) {
    if (date === today && !todaySet.has(id)) delete voted[id];
    else if (date !== today && !everSet.has(id)) delete voted[id];
  }
  for (const id of voted_today) {
    if (voted[String(id)] !== today) voted[String(id)] = today;
  }

  saveVoted(voted);
  saveBudget({ used: voted_today.length, day: today });
}

// ── FLIP animation ────────────────────────────────────────────────────────────
function capturePositions() {
  const map = new Map();
  document.querySelectorAll('#chart-list .song-card').forEach(card => {
    map.set(card.dataset.id, card.getBoundingClientRect().top);
  });
  return map;
}

function flipAnimate(prevTops) {
  document.querySelectorAll('#chart-list .song-card').forEach(card => {
    const prevTop = prevTops.get(card.dataset.id);
    if (prevTop === undefined) return;
    const deltaY = prevTop - card.getBoundingClientRect().top;
    if (Math.abs(deltaY) < 1) return;

    card.style.transition = 'none';
    card.style.transform  = `translateY(${deltaY}px)`;
    void card.offsetHeight;

    card.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.15, 0.64, 1)';
    card.style.transform  = '';
    card.addEventListener('transitionend', () => { card.style.transition = ''; }, { once: true });
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function rankClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-other';
}

function rankLabel(rank) {
  return rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : String(rank);
}

function fmtScore(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCard(song, rank, voted, hasVoteBudget) {
  const voteDate        = voted[song.id];
  const votedToday      = voteDate === todayIso();
  const previouslyVoted = voteDate !== undefined && !votedToday;
  const canVote         = hasVoteBudget && !votedToday;
  const retractable     = votedToday;

  const li = document.createElement('li');
  li.className = 'song-card';
  li.dataset.id = song.id;

  const voteIcon = retractable
    ? '<span class="icon-default">♥</span><span class="icon-hover">✕</span>'
    : '♡';

  const btnLabel = retractable
    ? 'Remove your vote'
    : previouslyVoted ? 'You supported this before — vote again?'
    : 'Vote for this song';

  let btnClass = 'vote-btn';
  if (retractable)          btnClass += ' voted retractable';
  else if (previouslyVoted) btnClass += ' previously-voted';

  li.innerHTML = `
    <span class="rank ${rankClass(rank)}" aria-label="Rank ${rank}">${rankLabel(rank)}</span>
    <div class="song-body">
      <p class="song-title">${escHtml(song.title)}</p>
      <p class="song-meta"><strong>${escHtml(song.artist)}</strong>${song.album ? ` &mdash; ${escHtml(song.album)}` : ''}</p>
    </div>
    <button
      class="${btnClass}"
      aria-label="${btnLabel}"
      aria-pressed="${retractable}"
      ${canVote || retractable ? '' : 'disabled'}
    >
      <span class="vote-icon" aria-hidden="true">${voteIcon}</span>
      <span class="vote-count">${fmtScore(song.score)}</span>
    </button>
  `;

  if (retractable) {
    li.querySelector('.vote-btn').addEventListener('click', () => retractVote(song.id));
  } else if (canVote) {
    li.querySelector('.vote-btn').addEventListener('click', () => castVote(song.id));
  }

  return li;
}

function artworkUrl(item, size = 50) {
  const url = item.attributes?.artwork?.url;
  if (!url) return null;
  return url.replace('{w}', size).replace('{h}', size);
}

function buildAppleCard(item) {
  const attr  = item.attributes ?? {};
  const title  = attr.name       ?? '';
  const artist = attr.artistName ?? '';
  const album  = attr.albumName  ?? '';
  const thumb  = artworkUrl(item, 50);

  const li = document.createElement('li');
  li.className = 'song-card apple-card';

  li.innerHTML = `
    ${thumb ? `<img class="apple-thumb" src="${escHtml(thumb)}" alt="" aria-hidden="true" width="50" height="50">` : '<span class="apple-thumb-placeholder"></span>'}
    <div class="song-body">
      <p class="song-title">${escHtml(title)}</p>
      <p class="song-meta"><strong>${escHtml(artist)}</strong>${album ? ` &mdash; ${escHtml(album)}` : ''}</p>
    </div>
    <button class="add-btn" aria-label="Add ${escHtml(title)} to SongBubble">+ Add</button>
  `;

  li.querySelector('.add-btn').addEventListener('click', () => selectAppleMusicSong(item, li));
  return li;
}

function groupHeader(text) {
  const li = document.createElement('li');
  li.className = 'results-group-label';
  li.textContent = text;
  return li;
}

function render(skipEntrance = false) {
  const list      = document.getElementById('chart-list');
  const noResults = document.getElementById('no-results');
  const budgetEl  = document.getElementById('vote-budget-display');
  const voted     = loadVoted();
  const remaining = votesRemaining();

  budgetEl.textContent = remaining > 0
    ? `${remaining} vote${remaining === 1 ? '' : 's'} left today`
    : 'No votes left today';

  list.innerHTML = '';

  if (!searchQuery) {
    // Chart mode — show top-10
    if (allSongs.length === 0) { noResults.classList.remove('hidden'); return; }
    noResults.classList.add('hidden');
    allSongs.forEach((song, i) => {
      const card = buildCard(song, i + 1, voted, remaining > 0);
      if (skipEntrance) card.style.animation = 'none';
      else card.style.animationDelay = `${i * 30}ms`;
      list.appendChild(card);
    });
    return;
  }

  // Search mode — two sections
  const dbSongs = searchResults ?? [];
  const amSongs = appleResults  ?? [];

  if (dbSongs.length === 0 && amSongs.length === 0) {
    noResults.classList.remove('hidden');
    return;
  }
  noResults.classList.add('hidden');

  if (dbSongs.length > 0) {
    if (amSongs.length > 0) list.appendChild(groupHeader('In SongBubble'));
    dbSongs.forEach((song, i) => {
      const card = buildCard(song, i + 1, voted, remaining > 0);
      if (skipEntrance) card.style.animation = 'none';
      list.appendChild(card);
    });
  }

  if (amSongs.length > 0) {
    list.appendChild(groupHeader('From Apple Music'));
    amSongs.forEach(item => list.appendChild(buildAppleCard(item)));
  }
}

// ── Apple Music song selection ────────────────────────────────────────────────
async function selectAppleMusicSong(item, li) {
  const btn  = li.querySelector('.add-btn');
  btn.disabled    = true;
  btn.textContent = 'Adding…';

  const attr = item.attributes ?? {};
  try {
    const res  = await fetch('/api/songs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:          attr.name       ?? '',
        artist:         attr.artistName ?? '',
        album:          attr.albumName  ?? '',
        apple_music_id: item.id,
        artwork_url:    attr.artwork?.url ?? null,
      }),
    });
    const data = await res.json();
    if (!res.ok && res.status !== 200) throw new Error(data.error ?? 'Failed');

    const song = data.song;
    // Move from Apple results to DB results
    appleResults  = (appleResults ?? []).filter(s => s.id !== item.id);
    searchResults = [...(searchResults ?? []), song];
    allSongs.push(song);
    allSongs.sort((a, b) => b.score - a.score);
    document.dispatchEvent(new CustomEvent('song-added', { detail: song }));
    render();
  } catch {
    btn.disabled    = false;
    btn.textContent = '+ Add';
  }
}

// ── Voting ────────────────────────────────────────────────────────────────────
async function castVote(songId) {
  const budget = loadBudget();
  const voted  = loadVoted();
  if (budget.used >= VOTES_PER_DAY || voted[songId] === todayIso()) return;

  const previousDate = voted[songId];

  const prevPositions = searchQuery ? null : capturePositions();
  voted[songId] = todayIso();
  budget.used += 1;
  saveVoted(voted);
  saveBudget(budget);
  const song = allSongs.find(s => s.id === songId);
  if (song) song.score += 1;
  allSongs.sort((a, b) => b.score - a.score);
  render(!!prevPositions);
  if (prevPositions) flipAnimate(prevPositions);

  const { ok, status } = await postVote(songId);
  if (!ok) {
    if (previousDate !== undefined) voted[songId] = previousDate;
    else delete voted[songId];
    budget.used -= 1;
    saveVoted(voted);
    saveBudget(budget);
    if (song) song.score = Math.max(0, song.score - 1);
    allSongs.sort((a, b) => b.score - a.score);
    if (status === 429) { budget.used = VOTES_PER_DAY; saveBudget(budget); }
    render(true);
  }
}

async function retractVote(songId) {
  const voted  = loadVoted();
  const budget = loadBudget();
  if (voted[songId] !== todayIso()) return;

  const prevPositions = searchQuery ? null : capturePositions();
  delete voted[songId];
  budget.used = Math.max(0, budget.used - 1);
  saveVoted(voted);
  saveBudget(budget);
  const song = allSongs.find(s => s.id === songId);
  if (song) song.score = Math.max(0, song.score - 1);
  allSongs.sort((a, b) => b.score - a.score);
  render(!!prevPositions);
  if (prevPositions) flipAnimate(prevPositions);

  const { ok } = await deleteVote(songId);
  if (!ok) {
    voted[songId] = todayIso();
    budget.used += 1;
    saveVoted(voted);
    saveBudget(budget);
    if (song) song.score += 1;
    allSongs.sort((a, b) => b.score - a.score);
    render(true);
  }
}

// ── Search ────────────────────────────────────────────────────────────────────
function initSearch() {
  const form  = document.getElementById('search-form');
  const input = document.getElementById('search-input');

  let debounce;

  async function runSearch(q) {
    searchQuery = q;
    if (!q) {
      searchResults = null;
      appleResults  = null;
      render();
      return;
    }
    render(); // Show stale results while fetching

    const [dbRes, amRes] = await Promise.all([
      searchSongs(q),
      searchAppleMusic(q),
    ]);
    if (q !== searchQuery) return; // Stale — a newer query is in flight

    // Filter Apple Music results already in the DB (matched by apple_music_id)
    const dbAmIds = new Set(dbRes.map(s => s.apple_music_id).filter(Boolean));
    searchResults = dbRes;
    appleResults  = amRes.filter(s => !dbAmIds.has(s.id));
    render();
  }

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    debounce = setTimeout(() => runSearch(q), 200);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearTimeout(debounce);
    runSearch(input.value.trim());
  });
}

// ── Song submission ───────────────────────────────────────────────────────────
document.addEventListener('song-added', (e) => {
  const song = e.detail;
  if (!song?.id) return;
  if (!allSongs.find(s => s.id === song.id)) {
    allSongs.push(song);
    allSongs.sort((a, b) => b.score - a.score);
  }
  if (searchResults && !searchResults.find(s => s.id === song.id)) {
    searchResults.push(song);
    searchResults.sort((a, b) => b.score - a.score);
  }
  render();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initSearch();
  initMusicKit(); // Non-blocking — search degrades gracefully if MusicKit fails

  document.getElementById('chart-list').innerHTML =
    '<li class="no-results">Loading…</li>';

  try {
    [allSongs] = await Promise.all([
      fetchSongs(),
      fetchMyVotes().then(reconcileVotes),
    ]);
    render();
  } catch {
    document.getElementById('chart-list').innerHTML =
      '<li class="no-results">Could not load the chart — please try refreshing.</li>';
  }
});
