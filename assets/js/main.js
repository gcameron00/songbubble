/**
 * SongBubble — main.js
 *
 * Chart mode:   shows top-10 with rank, loaded at boot.
 * Search mode:  unified list of DB + Apple Music results, no ranks.
 *               Voting an Apple Music song silently upserts it to the DB first.
 *
 * localStorage keys:
 *   sb_voted   — { [songId]: dateString }
 *   sb_budget  — { used: number, day: string }
 */

'use strict';

const VOTES_PER_DAY = 5;
const LS_VOTED      = 'sb_voted';
const LS_BUDGET     = 'sb_budget';

// ── App state ─────────────────────────────────────────────────────────────────
let allSongs      = [];   // full chart (all songs with active votes)
let searchQuery   = '';
let mergedResults = null; // unified search list, or null in chart mode
let visibleCount  = 10;   // how many chart entries are currently rendered
const LOAD_BATCH  = 10;   // songs appended per scroll trigger

// ── Playback state ────────────────────────────────────────────────────────────
// amId: the apple_music_id of the active song (or null); state: idle|loading|playing|paused
const playback = { amId: null, state: 'idle' };

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

    // Sync playback state to UI without a full re-render
    musicKit.addEventListener('playbackStateDidChange', () => {
      const s = musicKit.playbackState;
      if      (s === 2)                  playback.state = 'playing';
      else if (s === 3)                  playback.state = 'paused';
      else if (s === 1)                  playback.state = 'loading';
      else if (s === 0 || s === 4 || s === 5) {
        playback.amId  = null;
        playback.state = 'idle';
      }
      updatePlayUI();
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

// Normalise an Apple Music catalogue item into the same shape as a DB song.
// id: null signals it is not yet in our DB.
function normalizeAppleItem(item) {
  const attr = item.attributes ?? {};
  return {
    id:             null,
    _appleItem:     item,
    title:          attr.name       ?? '',
    artist:         attr.artistName ?? '',
    album:          attr.albumName  ?? '',
    artwork_url:    attr.artwork?.url ?? null,
    apple_music_id: item.id,
    score:          0,
  };
}

// Resolve Apple Music artwork template URL (replaces {w}/{h} placeholders).
function resolveArtwork(url, size = 56) {
  if (!url) return null;
  return url.replace('{w}', size).replace('{h}', size);
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
  const today = todayIso();
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

// ── Playback ──────────────────────────────────────────────────────────────────

async function playOrPause(song) {
  if (!musicKit || !song.apple_music_id) return;
  const amId = song.apple_music_id;

  if (playback.amId === amId) {
    if (playback.state === 'playing') { musicKit.pause(); return; }
    if (playback.state === 'paused')  { musicKit.play();  return; }
  }

  playback.amId  = amId;
  playback.state = 'loading';
  updatePlayUI();

  try {
    await musicKit.authorize();
    await musicKit.setQueue({ song: amId });
    await musicKit.play();
  } catch {
    playback.amId  = null;
    playback.state = 'idle';
    updatePlayUI();
  }
}

// Update only the play overlays in the DOM — avoids a full re-render during playback.
function updatePlayUI() {
  document.querySelectorAll('.thumb-wrap[data-am-id]').forEach(wrap => {
    const isActive  = wrap.dataset.amId === playback.amId;
    const isPlaying = isActive && playback.state === 'playing';
    const isLoading = isActive && playback.state === 'loading';
    wrap.classList.toggle('is-playing', isPlaying);
    wrap.classList.toggle('is-loading', isLoading);
    const overlay = wrap.querySelector('.play-overlay');
    if (!overlay) return;
    if (isLoading) {
      overlay.innerHTML = '<span class="play-spinner" aria-hidden="true"></span>';
      overlay.setAttribute('aria-label', 'Loading\u2026');
    } else if (isPlaying) {
      overlay.textContent = '\u23f8';
      overlay.setAttribute('aria-label', 'Pause');
    } else {
      overlay.textContent = '\u25b6';
      overlay.setAttribute('aria-label', 'Play');
    }
  });
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

// rank: number for chart mode, null for search mode (no rank shown).
// Songs with id === null are Apple Music-only and not yet in the DB.
function buildCard(song, rank, voted, hasVoteBudget) {
  const isNewSong       = song.id === null;
  const voteDate        = !isNewSong ? voted[song.id] : undefined;
  const votedToday      = voteDate === todayIso();
  const previouslyVoted = voteDate !== undefined && !votedToday;
  const canVote         = hasVoteBudget && !votedToday;
  const retractable     = votedToday;

  const li = document.createElement('li');
  li.className = 'song-card';
  if (!isNewSong) li.dataset.id = song.id;

  const thumb = resolveArtwork(song.artwork_url);

  // Build thumb / play-overlay area
  let thumbHtml = '';
  if (song.apple_music_id) {
    const isThisPlaying = song.apple_music_id === playback.amId;
    const ps        = isThisPlaying ? playback.state : 'idle';
    const isPlaying = ps === 'playing';
    const isLoading = ps === 'loading';
    const wrapClass = 'thumb-wrap' + (isPlaying ? ' is-playing' : '') + (isLoading ? ' is-loading' : '');
    const imgHtml   = thumb
      ? `<img class="song-thumb" src="${escHtml(thumb)}" alt="" aria-hidden="true" width="56" height="56">`
      : `<div class="song-thumb thumb-placeholder" aria-hidden="true"></div>`;
    const overlayContent = isLoading
      ? '<span class="play-spinner" aria-hidden="true"></span>'
      : (isPlaying ? '\u23f8' : '\u25b6');
    thumbHtml = `<div class="${wrapClass}" data-am-id="${escHtml(song.apple_music_id)}">${imgHtml}<button class="play-overlay" aria-label="${isPlaying ? 'Pause' : 'Play'} ${escHtml(song.title)}">${overlayContent}</button></div>`;
  } else if (thumb) {
    thumbHtml = `<img class="song-thumb" src="${escHtml(thumb)}" alt="" aria-hidden="true" width="56" height="56">`;
  }

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

  const btnEnabled = isNewSong ? hasVoteBudget : (canVote || retractable);

  li.innerHTML = `
    ${rank !== null ? `<span class="rank ${rankClass(rank)}" aria-label="Rank ${rank}">${rankLabel(rank)}</span>` : ''}
    ${thumbHtml}
    <div class="song-body">
      <p class="song-title">${escHtml(song.title)}</p>
      <p class="song-meta"><strong>${escHtml(song.artist)}</strong>${song.album ? ` &mdash; ${escHtml(song.album)}` : ''}</p>
    </div>
    <button class="${btnClass}" aria-label="${btnLabel}" aria-pressed="${retractable}" ${btnEnabled ? '' : 'disabled'}>
      <span class="vote-icon" aria-hidden="true">${voteIcon}</span>
      <span class="vote-count">${fmtScore(song.score)}</span>
    </button>
  `;

  const btn = li.querySelector('.vote-btn');
  if (retractable) {
    btn.addEventListener('click', () => retractVote(song.id));
  } else if (isNewSong && hasVoteBudget) {
    btn.addEventListener('click', () => addThenVote(song, li));
  } else if (canVote) {
    btn.addEventListener('click', () => castVote(song.id));
  }

  const playOverlay = li.querySelector('.play-overlay');
  if (playOverlay) playOverlay.addEventListener('click', () => playOrPause(song));

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
    // Chart mode — ranked, initially visibleCount songs
    const chartSongs = allSongs.slice(0, visibleCount);
    if (chartSongs.length === 0) { noResults.classList.remove('hidden'); updateSentinel(); return; }
    noResults.classList.add('hidden');
    chartSongs.forEach((song, i) => {
      const card = buildCard(song, i + 1, voted, remaining > 0);
      if (skipEntrance) card.style.animation = 'none';
      else card.style.animationDelay = `${i * 30}ms`;
      list.appendChild(card);
    });
    updateSentinel();
    return;
  }

  // Search mode — unified list, no ranks
  const songs = mergedResults ?? [];
  if (songs.length === 0) { noResults.classList.remove('hidden'); return; }
  noResults.classList.add('hidden');
  songs.forEach(song => list.appendChild(buildCard(song, null, voted, remaining > 0)));
}

// ── Infinite scroll ───────────────────────────────────────────────────────────
function updateSentinel() {
  const sentinel = document.getElementById('chart-sentinel');
  if (sentinel) sentinel.hidden = !!searchQuery || visibleCount >= allSongs.length;
}

function appendNextBatch() {
  if (searchQuery || visibleCount >= allSongs.length) return;
  const list      = document.getElementById('chart-list');
  const voted     = loadVoted();
  const remaining = votesRemaining();
  const start     = visibleCount;
  const end       = Math.min(visibleCount + LOAD_BATCH, allSongs.length);
  for (let i = start; i < end; i++) {
    const card = buildCard(allSongs[i], i + 1, voted, remaining > 0);
    card.style.animationDelay = `${(i - start) * 30}ms`;
    list.appendChild(card);
  }
  visibleCount = end;
  updateSentinel();
}

function initScrollLoad() {
  const sentinel = document.getElementById('chart-sentinel');
  if (!sentinel) return;
  const observer = new IntersectionObserver(
    entries => { if (entries[0].isIntersecting) appendNextBatch(); },
    { rootMargin: '200px' },
  );
  observer.observe(sentinel);
}

// ── Voting ────────────────────────────────────────────────────────────────────

// Add an Apple Music song to the DB, then immediately cast a vote for it.
async function addThenVote(song, li) {
  const btn = li.querySelector('.vote-btn');
  btn.disabled = true;

  try {
    const res  = await fetch('/api/songs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:          song.title,
        artist:         song.artist,
        album:          song.album,
        apple_music_id: song.apple_music_id,
        artwork_url:    song.artwork_url,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Failed');

    const dbSong = data.song;

    // Replace the Apple Music stub with the real DB entry in mergedResults.
    if (mergedResults) {
      const idx = mergedResults.findIndex(
        s => s.apple_music_id === song.apple_music_id && s.id === null,
      );
      if (idx !== -1) mergedResults[idx] = { ...dbSong };
    }
    if (!allSongs.find(s => s.id === dbSong.id)) {
      allSongs.push(dbSong);
      allSongs.sort((a, b) => b.score - a.score);
    }

    await castVote(dbSong.id);
  } catch {
    btn.disabled = false;
  }
}

async function castVote(songId) {
  const budget = loadBudget();
  const voted  = loadVoted();
  if (budget.used >= VOTES_PER_DAY || voted[songId] === todayIso()) return;

  const previousDate  = voted[songId];
  const prevPositions = searchQuery ? null : capturePositions();

  voted[songId] = todayIso();
  budget.used += 1;
  saveVoted(voted);
  saveBudget(budget);

  const song = allSongs.find(s => s.id === songId);
  if (song) song.score += 1;
  allSongs.sort((a, b) => b.score - a.score);

  // Also update score in mergedResults so it re-renders correctly.
  if (mergedResults) {
    const s = mergedResults.find(s => s.id === songId);
    if (s) s.score += 1;
  }

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
    if (mergedResults) {
      const s = mergedResults.find(s => s.id === songId);
      if (s) s.score = Math.max(0, s.score - 1);
    }
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
  if (mergedResults) {
    const s = mergedResults.find(s => s.id === songId);
    if (s) s.score = Math.max(0, s.score - 1);
  }
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
    if (mergedResults) {
      const s = mergedResults.find(s => s.id === songId);
      if (s) s.score += 1;
    }
    allSongs.sort((a, b) => b.score - a.score);
    render(true);
  }
}

// ── Search ────────────────────────────────────────────────────────────────────
function initSearch() {
  const form     = document.getElementById('search-form');
  const input    = document.getElementById('search-input');
  const backdrop = document.getElementById('search-backdrop');

  let debounce;

  function closeSearch() {
    input.value = '';
    input.dispatchEvent(new Event('input')); // notify submit.js to hide its prompt
    runSearch('');
    input.blur();
  }

  async function runSearch(q) {
    searchQuery = q;
    document.body.classList.toggle('is-searching', !!q);

    if (!q) {
      mergedResults = null;
      render();
      return;
    }
    render();

    const [dbSongs, amItems] = await Promise.all([
      searchSongs(q),
      searchAppleMusic(q),
    ]);
    if (q !== searchQuery) return;

    // Filter Apple Music items already in the DB (matched by apple_music_id).
    const dbAmIds = new Set(dbSongs.map(s => s.apple_music_id).filter(Boolean));
    const amSongs = amItems
      .filter(item => !dbAmIds.has(item.id))
      .map(normalizeAppleItem);

    // DB results first (by score), Apple Music after.
    mergedResults = [...dbSongs, ...amSongs];
    render();
  }

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    debounce = setTimeout(() => runSearch(q), 200);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSearch();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    clearTimeout(debounce);
    runSearch(input.value.trim());
  });

  backdrop.addEventListener('click', closeSearch);
}

// ── Song submission ───────────────────────────────────────────────────────────
document.addEventListener('song-added', (e) => {
  const song = e.detail;
  if (!song?.id) return;
  if (!allSongs.find(s => s.id === song.id)) {
    allSongs.push(song);
    allSongs.sort((a, b) => b.score - a.score);
  }
  if (mergedResults && !mergedResults.find(s => s.id === song.id)) {
    mergedResults.push(song);
    mergedResults.sort((a, b) => b.score - a.score);
  }
  render();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initSearch();
  initMusicKit();
  initScrollLoad();

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
