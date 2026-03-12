/**
 * LyricBubble — main.js
 *
 * Fetches the chart from /api/lyrics and posts votes to /api/votes.
 *
 * localStorage is used only for UI state (which lyrics this browser has voted
 * for, and the local vote budget counter). The server is the source of truth.
 *
 *   lb_voted   — JSON array of lyric IDs voted for by this browser
 *   lb_budget  — { used: number, day: string }
 */

'use strict';

const VOTES_PER_DAY = 5;
const LS_VOTED      = 'lb_voted';
const LS_BUDGET     = 'lb_budget';

// ── App state ─────────────────────────────────────────────────────────────────
let allLyrics   = [];
let searchQuery = '';

// ── localStorage helpers ──────────────────────────────────────────────────────
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// voted is stored as { [lyricId]: dateString } so we know if a vote was cast today.
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
async function fetchLyrics() {
  const res = await fetch('/api/lyrics');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postVote(lyricId) {
  const res = await fetch('/api/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lyric_id: lyricId }),
  });
  return { ok: res.ok, status: res.status };
}

async function deleteVote(lyricId) {
  const res = await fetch('/api/votes', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lyric_id: lyricId }),
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
// - Clears today-entries that no longer exist on the server (e.g. after a wipe).
// - Clears previous-day entries for lyrics the server has no record of.
// - Adds today's server votes that localStorage is missing.
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

// Snapshot the vertical position of every card currently in the chart.
function capturePositions() {
  const map = new Map();
  document.querySelectorAll('#chart-list .lyric-card').forEach(card => {
    map.set(card.dataset.id, card.getBoundingClientRect().top);
  });
  return map;
}

// After a re-render, animate each card from where it was to where it is now.
function flipAnimate(prevTops) {
  document.querySelectorAll('#chart-list .lyric-card').forEach(card => {
    const prevTop = prevTops.get(card.dataset.id);
    if (prevTop === undefined) return;
    const deltaY = prevTop - card.getBoundingClientRect().top;
    if (Math.abs(deltaY) < 1) return;

    // Invert: jump the card back to its old position instantly.
    card.style.transition = 'none';
    card.style.transform  = `translateY(${deltaY}px)`;
    void card.offsetHeight; // force reflow

    // Play: animate to the natural (new) position.
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

function buildCard(lyric, rank, voted, hasVoteBudget) {
  const voteDate        = voted[lyric.id];
  const votedToday      = voteDate === todayIso();
  const previouslyVoted = voteDate !== undefined && !votedToday;
  // Can vote if budget allows AND haven't already voted today.
  const canVote         = hasVoteBudget && !votedToday;
  const retractable     = votedToday;

  const li = document.createElement('li');
  li.className = 'lyric-card';
  li.dataset.id = lyric.id;

  // Voted today: ♥ swaps to ✕ on hover (retractable).
  // Previously voted (not today): ♡ with a subtle indicator — can vote again.
  // Never voted: plain ♡.
  const voteIcon = retractable
    ? '<span class="icon-default">♥</span><span class="icon-hover">✕</span>'
    : '♡';

  const btnLabel = retractable
    ? 'Remove your vote'
    : previouslyVoted ? 'You supported this before — vote again?'
    : 'Vote for this lyric';

  let btnClass = 'vote-btn';
  if (retractable)     btnClass += ' voted retractable';
  else if (previouslyVoted) btnClass += ' previously-voted';

  li.innerHTML = `
    <span class="rank ${rankClass(rank)}" aria-label="Rank ${rank}">${rankLabel(rank)}</span>
    <div class="lyric-body">
      <p class="lyric-text">${escHtml(lyric.text)}</p>
      <p class="lyric-meta"><strong>${escHtml(lyric.artist)}</strong> &mdash; ${escHtml(lyric.song)}</p>
    </div>
    <button
      class="${btnClass}"
      aria-label="${btnLabel}"
      aria-pressed="${retractable}"
      ${canVote || retractable ? '' : 'disabled'}
    >
      <span class="vote-icon" aria-hidden="true">${voteIcon}</span>
      <span class="vote-count">${fmtScore(lyric.score)}</span>
    </button>
  `;

  if (retractable) {
    li.querySelector('.vote-btn').addEventListener('click', () => retractVote(lyric.id));
  } else if (canVote) {
    li.querySelector('.vote-btn').addEventListener('click', () => castVote(lyric.id));
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
    ? allLyrics.filter(l =>
        `${l.artist} ${l.song} ${l.text}`.toLowerCase().includes(searchQuery)
      )
    : allLyrics;

  list.innerHTML = '';

  if (filtered.length === 0) {
    noResults.classList.remove('hidden');
    return;
  }
  noResults.classList.add('hidden');

  filtered.forEach((lyric, i) => {
    const card = buildCard(lyric, i + 1, voted, remaining > 0);
    if (skipEntrance) {
      card.style.animation = 'none'; // suppress entrance so FLIP can drive movement
    } else {
      card.style.animationDelay = `${i * 30}ms`;
    }
    list.appendChild(card);
  });
}

// ── Voting ────────────────────────────────────────────────────────────────────
async function castVote(lyricId) {
  const budget = loadBudget();
  const voted  = loadVoted();
  // Block only if already voted today — previous days are fine.
  if (budget.used >= VOTES_PER_DAY || voted[lyricId] === todayIso()) return;

  const previousDate = voted[lyricId]; // preserve for rollback

  // Optimistic update — feels instant for the user.
  const prevPositions = searchQuery ? null : capturePositions();
  voted[lyricId] = todayIso();
  budget.used += 1;
  saveVoted(voted);
  saveBudget(budget);
  const lyric = allLyrics.find(l => l.id === lyricId);
  if (lyric) lyric.score += 1;
  allLyrics.sort((a, b) => b.score - a.score);
  render(!!prevPositions);
  if (prevPositions) flipAnimate(prevPositions);

  // Confirm with the server.
  const { ok, status } = await postVote(lyricId);
  if (!ok) {
    // Roll back, restoring the previous vote date if there was one.
    if (previousDate !== undefined) voted[lyricId] = previousDate;
    else delete voted[lyricId];
    budget.used -= 1;
    saveVoted(voted);
    saveBudget(budget);
    if (lyric) lyric.score = Math.max(0, lyric.score - 1);
    allLyrics.sort((a, b) => b.score - a.score);
    // Server says budget exhausted — sync local state so we stop trying.
    if (status === 429) { budget.used = VOTES_PER_DAY; saveBudget(budget); }
    render(true); // silent revert — no entrance flash, no FLIP
  }
}

async function retractVote(lyricId) {
  const voted  = loadVoted();
  const budget = loadBudget();
  if (voted[lyricId] !== todayIso()) return;

  // Optimistic update.
  const prevPositions = searchQuery ? null : capturePositions();
  delete voted[lyricId];
  budget.used = Math.max(0, budget.used - 1);
  saveVoted(voted);
  saveBudget(budget);
  const lyric = allLyrics.find(l => l.id === lyricId);
  if (lyric) lyric.score = Math.max(0, lyric.score - 1);
  allLyrics.sort((a, b) => b.score - a.score);
  render(!!prevPositions);
  if (prevPositions) flipAnimate(prevPositions);

  // Confirm with the server.
  const { ok } = await deleteVote(lyricId);
  if (!ok) {
    // Roll back.
    voted[lyricId] = todayIso();
    budget.used += 1;
    saveVoted(voted);
    saveBudget(budget);
    if (lyric) lyric.score += 1;
    allLyrics.sort((a, b) => b.score - a.score);
    render(true); // silent revert — no entrance flash, no FLIP
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

// ── Lyric submission ──────────────────────────────────────────────────────────
// Receives new lyrics from submit.js after a successful POST and splices them
// into the live chart so the user can vote immediately without a page reload.
document.addEventListener('lyric-added', (e) => {
  const lyric = e.detail;
  if (!lyric?.id) return;
  allLyrics.push(lyric);
  allLyrics.sort((a, b) => b.score - a.score);
  render();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initSearch();

  document.getElementById('chart-list').innerHTML =
    '<li class="no-results">Loading&hellip;</li>';

  try {
    [allLyrics] = await Promise.all([
      fetchLyrics(),
      fetchMyVotes().then(reconcileVotes),
    ]);
    render();
  } catch {
    document.getElementById('chart-list').innerHTML =
      '<li class="no-results">Could not load the chart &mdash; please try refreshing.</li>';
  }
});
