'use strict';

/**
 * Song submission UI.
 *
 * Watches the search input and surfaces an "Add a song" prompt whenever
 * the user has typed 2+ characters. Clicking the prompt opens an inline
 * form; successful submissions dispatch a 'song-added' CustomEvent so
 * main.js can add the new song to the live chart.
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

function validateForm(title, artist, album) {
  const errors = {};
  const all = `${title} ${artist} ${album}`;

  if (!title.trim())                  errors.title  = 'Song title is required.';
  else if (title.trim().length < 2)   errors.title  = 'Title is too short.';
  else if (title.length > MAX_FIELD)  errors.title  = `Max ${MAX_FIELD} characters.`;

  if (!artist.trim())                 errors.artist = 'Artist name is required.';
  else if (artist.length > MAX_FIELD) errors.artist = 'Too long.';

  if (album.length > MAX_FIELD)       errors.album  = 'Too long.';

  if (!Object.keys(errors).length) {
    if (URL_RE.test(all))              errors.title = 'Links are not allowed.';
    else if (EMAIL_RE.test(all))       errors.title = 'Email addresses are not allowed.';
    else if (REPEAT_RE.test(all))      errors.title = 'This looks like spam.';
    else if (containsBlockedWord(all)) errors.title = "Contains content we can't accept.";
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

function getSection() { return document.getElementById('song-add'); }

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
          ? 'No results — is this song missing from the chart?'
          : 'Not seeing the song you have in mind?'}
      </span>
      <button class="add-prompt-btn" id="add-song-btn">+ Add a song</button>
    </div>`;

  document.getElementById('add-song-btn').addEventListener('click', openForm);
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
        <h3 class="add-panel-title">Add a song</h3>
        <button class="add-close" aria-label="Close" id="add-close">&times;</button>
      </div>
      <p class="add-panel-sub">Nominate a song for the chart. It will enter with zero votes — you can vote for it straight away.</p>

      <div class="add-field">
        <label class="add-label" for="add-input-title">Song title <span class="add-required">*</span></label>
        <input class="add-input" id="add-input-title" type="text" maxlength="110"
          placeholder="e.g. Bohemian Rhapsody" autocomplete="off" />
        <div class="add-field-footer">
          <span class="add-error" id="err-title"></span>
          <span id="count-title">${charCounter(0, MAX_FIELD)}</span>
        </div>
      </div>

      <div class="add-field">
        <label class="add-label" for="add-input-artist">Artist <span class="add-required">*</span></label>
        <input class="add-input" id="add-input-artist" type="text" maxlength="110"
          placeholder="e.g. Queen" autocomplete="off" />
        <span class="add-error" id="err-artist"></span>
      </div>

      <div class="add-field">
        <label class="add-label" for="add-input-album">Album <span class="add-optional">(optional)</span></label>
        <input class="add-input" id="add-input-album" type="text" maxlength="110"
          placeholder="e.g. A Night at the Opera" autocomplete="off" />
        <span class="add-error" id="err-album"></span>
      </div>

      <div class="add-actions">
        <button class="add-submit-btn" id="add-submit">Add song</button>
        <button class="add-cancel-btn" id="add-cancel">Cancel</button>
      </div>
    </div>`;

  const titleEl = document.getElementById('add-input-title');
  titleEl.addEventListener('input', () => {
    document.getElementById('count-title').innerHTML = charCounter(titleEl.value.length, MAX_FIELD);
  });

  document.getElementById('add-close').addEventListener('click', closeForm);
  document.getElementById('add-cancel').addEventListener('click', closeForm);
  document.getElementById('add-submit').addEventListener('click', handleSubmit);
  titleEl.focus();
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
  ['err-title', 'err-artist', 'err-album'].forEach(id => setError(id, ''));
}

async function handleSubmit() {
  clearErrors();
  const title  = document.getElementById('add-input-title')?.value  ?? '';
  const artist = document.getElementById('add-input-artist')?.value ?? '';
  const album  = document.getElementById('add-input-album')?.value  ?? '';

  const errors = validateForm(title, artist, album);
  if (Object.keys(errors).length) {
    if (errors.title)  setError('err-title',  errors.title);
    if (errors.artist) setError('err-artist', errors.artist);
    if (errors.album)  setError('err-album',  errors.album);
    return;
  }

  const btn = document.getElementById('add-submit');
  btn.disabled    = true;
  btn.textContent = 'Adding…';

  try {
    const res  = await fetch('/api/songs', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: title.trim(), artist: artist.trim(), album: album.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 422 && Array.isArray(data.errors)) {
        data.errors.forEach(e => setError('err-' + e.field, e.message));
      } else {
        setError('err-title', data.error ?? 'Submission failed — please try again.');
      }
      btn.disabled    = false;
      btn.textContent = 'Add song';
      return;
    }

    if (data.song) {
      document.dispatchEvent(new CustomEvent('song-added', { detail: data.song }));
    }
    showSuccess(title.trim(), artist.trim());
  } catch {
    setError('err-title', 'Network error — please try again.');
    btn.disabled    = false;
    btn.textContent = 'Add song';
  }
}

function showSuccess(title, artist) {
  formOpen = false;
  const section = getSection();
  if (!section) return;
  section.innerHTML = `
    <div class="add-success">
      <span class="add-success-icon" aria-hidden="true">✓</span>
      <span><strong>Song added!</strong> "${escHtml(title)}" by ${escHtml(artist)} is now on the chart with zero votes. Scroll down to find it and be the first to vote.</span>
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
