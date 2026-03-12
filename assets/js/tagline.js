'use strict';

const SWAP_INTERVAL  = 3500; // ms between phrase changes
const ANIM_DURATION  = 380;  // ms for each slide transition

async function loadPhrases() {
  try {
    const res = await fetch('/assets/data/taglines.json');
    return res.ok ? res.json() : null;
  } catch { return null; }
}

function animateSwap(el, newText) {
  // Slide current phrase up and fade out.
  el.style.transition = `opacity ${ANIM_DURATION}ms ease, transform ${ANIM_DURATION}ms ease`;
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(-0.45em)';

  setTimeout(() => {
    // Instantly reset to below the baseline, then animate into place.
    el.textContent     = newText;
    el.style.transition = 'none';
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(0.45em)';

    // Force a reflow so the reset takes effect before re-enabling transition.
    void el.offsetHeight;

    el.style.transition = `opacity ${ANIM_DURATION}ms ease, transform ${ANIM_DURATION}ms ease`;
    el.style.opacity    = '1';
    el.style.transform  = 'translateY(0)';
  }, ANIM_DURATION);
}

async function initTagline() {
  const el = document.getElementById('tagline-phrase');
  if (!el) return;

  const phrases = await loadPhrases();
  if (!phrases || phrases.length < 2) return;

  let currentIndex = phrases.indexOf(el.textContent.trim());
  if (currentIndex === -1) currentIndex = 0;

  setInterval(() => {
    let next;
    do { next = Math.floor(Math.random() * phrases.length); }
    while (next === currentIndex);
    currentIndex = next;
    animateSwap(el, phrases[next]);
  }, SWAP_INTERVAL);
}

document.addEventListener('DOMContentLoaded', initTagline);
