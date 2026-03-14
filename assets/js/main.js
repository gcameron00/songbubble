/**
 * SongBubble — main.js
 *
 * Fetches the chart from /api/songs and posts votes to /api/votes.
 *
 * localStorage is used only for UI state (which songs this browser has voted
 * for, and the local vote budget counter). The server is the source of truth.
 *
 *   sb_voted   — JSON object { [songId]: dateString }
 *   sb_budget  — { used: number, day: string }
 */

'use strict';

const VOTES_PER_DAY = 5;
const LS_VOTED      = 'sb_voted';
const LS_BUDGET     = 'sb_budget';

// ── App state ─────────────────────────────────────────────────────────────────
let allSongs    = [];
let searchQuery = '';

// ── localStorage helpers ──────────────────────────────────────────────────────
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// voted is stored as { [songId]: dateString } so we know if a vote was cast today.
function loadVoted() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_VOTED));
    if (!raw) return {};
    // Gracefully handle the old array format.
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

// Reconcile localStorage against the server's vote state.
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

function render(skipEntrance = false) {
  const list      = document.getElementById('chart-list');
  const noResults = document.getElementById('no-results');
  const budgetEl  = document.getElementById('vote-budget-display');
  const voted     = loadVoted();
  const remaining = votesRemaining();

  budgetEl.textContent = remaining > 0
    ? `${remaining} vote${remaining === 1 ? '' : 's'} left today`
    : 'No votes left today';

  const filtered = searchQuery
    ? allSongs.filter(s =>
        `${s.artist} ${s.title} ${s.album ?? ''}`.toLowerCase().includes(searchQuery)
      )
    : allSongs;

  list.innerHTML = '';

  if (filtered.length === 0) {
    noResults.classList.remove('hidden');
    return;
  }
  noResults.classList.add('hidden');

  filtered.forEach((song, i) => {
    const card = buildCard(song, i + 1, voted, remaining > 0);
    if (skipEntrance) {
      card.style.animation = 'none';
    } else {
      card.style.animationDelay = `${i * 30}ms`;
    }
    list.appendChild(card);
  });
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
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = input.value.trim().toLowerCase();
      render();
    }, 150);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    searchQuery = input.value.trim().toLowerCase();
    render();
  });
}

// ── Song submission ───────────────────────────────────────────────────────────
// Receives new songs from submit.js after a successful POST and splices them
// into the live chart so the user can vote immediately without a page reload.
document.addEventListener('song-added', (e) => {
  const song = e.detail;
  if (!song?.id) return;
  allSongs.push(song);
  allSongs.sort((a, b) => b.score - a.score);
  render();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initSearch();

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
