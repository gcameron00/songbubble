'use strict';

/**
 * Lyric submission UI.
 *
 * Watches the search input and surfaces an "Add a lyric" prompt whenever
 * the user has typed 2+ characters. Clicking the prompt opens an inline
 * form; successful submissions dispatch a 'lyric-added' CustomEvent so
 * main.js can add the new lyric to the live chart.
 *
 * Client-side validation mirrors server-side validate.ts (server enforces
 * authoritatively — this is purely for fast feedback).
 */

// ── Client-side validation ────────────────────────────────────────────────────

const BLOCKLIST = [
  'fuck', 'fucker', 'fuckers', 'fucked', 'fucking', 'fuckhead', 'fucks',
  'motherfucker', 'motherfuckers', 'motherfucking',
  'shit', 'shits', 'shitty', 'bullshit', 'horseshit',
  'cunt', 'cunts', 'cock', 'cocks', 'cocksucker', 'cocksuckers',
  'dickhead', 'dickheads', 'pussy', 'pussies',
  'ass', 'arse', 'asshole', 'assholes', 'arsehole', 'arseholes',
  'bastard', 'bastards', 'bitch', 'bitches',
  'whore', 'whores', 'slut', 'sluts',
  'prick', 'pricks', 'twat', 'twats', 'wanker', 'wankers', 'wank', 'bollocks',
  'nigger', 'niggers', 'nigga', 'niggas',
  'faggot', 'faggots', 'kike', 'kikes',
  'spic', 'spics', 'chink', 'chinks', 'gook', 'gooks',
  'retard', 'retards', 'tranny', 'trannies',
];

const URL_RE    = /https?:\/\/|www\.\S|\.com\b|\.net\b|\.org\b/i;
const EMAIL_RE  = /\S+@\S+\.\S+/;
const REPEAT_RE = /(.)\1{6,}/;
const MAX_LYRIC = 300;
const MAX_FIELD = 100;

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/8/g, 'b')
    .replace(/@/g, 'a').replace(/\$/g, 's')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function containsBlockedWord(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).some(w => BLOCKLIST.includes(w));
}

function validateForm(lyric, artist, song) {
  const errors = {};
  const all = `${lyric} ${artist} ${song}`;

  if (!lyric.trim())                   errors.lyric = 'Lyric line is required.';
  else if (lyric.trim().length < 5)    errors.lyric = 'Lyric is too short.';
  else if (lyric.length > MAX_LYRIC)   errors.lyric = `Max ${MAX_LYRIC} characters.`;

  if (!artist.trim())                  errors.artist = 'Artist name is required.';
  else if (artist.length > MAX_FIELD)  errors.artist = 'Too long.';

  if (!song.trim())                    errors.song = 'Song title is required.';
  else if (song.length > MAX_FIELD)    errors.song = 'Too long.';

  if (!Object.keys(errors).length) {
    if (URL_RE.test(all))              errors.lyric = 'Links are not allowed.';
    else if (EMAIL_RE.test(all))       errors.lyric = 'Email addresses are not allowed.';
    else if (REPEAT_RE.test(all))      errors.lyric = 'This looks like spam.';
    else if (containsBlockedWord(all)) errors.lyric = "Contains content we can't accept.";
  }

  return errors;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function charCounter(current, max) {
  const over = current > max;
  return `<span class="add-char-count${over ? ' add-char-count--over' : ''}">${current}/${max}</span>`;
}

function getSection() { return document.getElementById('lyric-add'); }

// ── State ─────────────────────────────────────────────────────────────────────

let formOpen = false;

// ── Prompt ────────────────────────────────────────────────────────────────────

function renderPrompt(query, noResults) {
  const section = getSection();
  if (!section) return;

  if (!query || query.length < 2) {
    section.innerHTML = '';
    section.hidden = true;
    formOpen = false;
    return;
  }

  if (formOpen) return;

  section.hidden = false;
  const prominent = noResults;
  section.innerHTML = `
    <div class="add-prompt${prominent ? ' add-prompt--prominent' : ''}">
      <span class="add-prompt-text">
        ${prominent
          ? 'No results — is this lyric missing from the chart?'
          : 'Not seeing the line you have in mind?'}
      </span>
      <button class="add-prompt-btn" id="add-lyric-btn">+ Add a lyric</button>
    </div>`;

  document.getElementById('add-lyric-btn').addEventListener('click', openForm);
}

// ── Form ──────────────────────────────────────────────────────────────────────

function openForm() {
  const section = getSection();
  if (!section) return;
  formOpen = true;
  section.hidden = false;

  section.innerHTML = `
    <div class="add-panel" id="add-panel">
      <div class="add-panel-header">
        <h3 class="add-panel-title">Add a lyric</h3>
        <button class="add-close" aria-label="Close" id="add-close">&times;</button>
      </div>
      <p class="add-panel-sub">Share a line that deserves more love. It will enter the chart with zero votes — you can vote for it straight away.</p>

      <div class="add-field">
        <label class="add-label" for="add-input-lyric">Lyric line <span class="add-required">*</span></label>
        <textarea class="add-textarea" id="add-input-lyric" rows="2" maxlength="320"
          placeholder="The exact line, as sung\u2026" autocomplete="off"></textarea>
        <div class="add-field-footer">
          <span class="add-error" id="err-lyric"></span>
          <span id="count-lyric">${charCounter(0, MAX_LYRIC)}</span>
        </div>
      </div>

      <div class="add-field">
        <label class="add-label" for="add-input-artist">Artist <span class="add-required">*</span></label>
        <input class="add-input" id="add-input-artist" type="text" maxlength="110"
          placeholder="e.g. Radiohead" autocomplete="off" />
        <span class="add-error" id="err-artist"></span>
      </div>

      <div class="add-field">
        <label class="add-label" for="add-input-song">Song title <span class="add-required">*</span></label>
        <input class="add-input" id="add-input-song" type="text" maxlength="110"
          placeholder="e.g. Fake Plastic Trees" autocomplete="off" />
        <span class="add-error" id="err-song"></span>
      </div>

      <div class="add-actions">
        <button class="add-submit-btn" id="add-submit">Submit lyric</button>
        <button class="add-cancel-btn" id="add-cancel">Cancel</button>
      </div>
    </div>`;

  const lyricEl = document.getElementById('add-input-lyric');
  lyricEl.addEventListener('input', () => {
    document.getElementById('count-lyric').innerHTML = charCounter(lyricEl.value.length, MAX_LYRIC);
  });

  document.getElementById('add-close').addEventListener('click', closeForm);
  document.getElementById('add-cancel').addEventListener('click', closeForm);
  document.getElementById('add-submit').addEventListener('click', handleSubmit);
  lyricEl.focus();
}

function closeForm() {
  formOpen = false;
  const section = getSection();
  if (section) { section.innerHTML = ''; section.hidden = true; }
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearErrors() {
  ['err-lyric', 'err-artist', 'err-song'].forEach(id => setError(id, ''));
}

async function handleSubmit() {
  clearErrors();
  const lyric  = document.getElementById('add-input-lyric')?.value  ?? '';
  const artist = document.getElementById('add-input-artist')?.value ?? '';
  const song   = document.getElementById('add-input-song')?.value   ?? '';

  const errors = validateForm(lyric, artist, song);
  if (Object.keys(errors).length) {
    if (errors.lyric)  setError('err-lyric',  errors.lyric);
    if (errors.artist) setError('err-artist', errors.artist);
    if (errors.song)   setError('err-song',   errors.song);
    return;
  }

  const btn = document.getElementById('add-submit');
  btn.disabled    = true;
  btn.textContent = 'Submitting\u2026';

  try {
    const res  = await fetch('/api/lyrics', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: lyric.trim(), artist: artist.trim(), song: song.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 422 && Array.isArray(data.errors)) {
        data.errors.forEach(e => setError('err-' + e.field, e.message));
      } else {
        setError('err-lyric', data.error ?? 'Submission failed — please try again.');
      }
      btn.disabled    = false;
      btn.textContent = 'Submit lyric';
      return;
    }

    if (data.lyric) {
      document.dispatchEvent(new CustomEvent('lyric-added', { detail: data.lyric }));
    }
    showSuccess(artist.trim(), song.trim());
  } catch {
    setError('err-lyric', 'Network error — please try again.');
    btn.disabled    = false;
    btn.textContent = 'Submit lyric';
  }
}

function showSuccess(artist, song) {
  formOpen = false;
  const section = getSection();
  if (!section) return;
  section.innerHTML = `
    <div class="add-success">
      <span class="add-success-icon" aria-hidden="true">✓</span>
      <span><strong>Lyric added!</strong> "${escHtml(artist)} — ${escHtml(song)}" is now on the chart with zero votes. Scroll down to find it and be the first to vote.</span>
      <button class="add-close" id="add-dismiss" aria-label="Dismiss">&times;</button>
    </div>`;
  document.getElementById('add-dismiss').addEventListener('click', () => {
    section.innerHTML = '';
    section.hidden = true;
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  let debounce;
  const update = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (formOpen) return;
      const query     = searchInput.value.trim();
      const noResults = !document.getElementById('no-results')?.classList.contains('hidden');
      renderPrompt(query, noResults);
    }, 250);
  };

  searchInput.addEventListener('input',  update);
  searchInput.addEventListener('search', update);
});
