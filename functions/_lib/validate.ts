/**
 * Shared validation for song submissions.
 * Applied server-side in POST /api/songs.
 *
 * Content policy:
 *   - Identity-based slurs and common profanity are blocked.
 *     Adjust BLOCKLIST to tune the policy — the list is intentionally
 *     the first line of defence, not an exhaustive filter.
 *   - URLs, emails, and obvious spam patterns are always rejected.
 *   - Length limits prevent low-quality or oversized submissions.
 *
 * Word-level matching (split on whitespace then exact compare) avoids
 * false positives in legitimate words that contain offensive substrings.
 * Leet-speak normalisation (0→o, $→s, etc.) catches common evasions.
 */

const BLOCKLIST: readonly string[] = [
  // Profanity
  'fuck', 'fucker', 'fuckers', 'fucked', 'fucking', 'fuckhead', 'fucks',
  'motherfucker', 'motherfuckers', 'motherfucking',
  'shit', 'shits', 'shitty', 'bullshit', 'horseshit',
  'cunt', 'cunts',
  'cock', 'cocks', 'cocksucker', 'cocksuckers',
  'dickhead', 'dickheads',
  'pussy', 'pussies',
  'ass', 'arse', 'asshole', 'assholes', 'arsehole', 'arseholes',
  'bastard', 'bastards',
  'bitch', 'bitches',
  'whore', 'whores', 'slut', 'sluts',
  'prick', 'pricks', 'twat', 'twats',
  'wanker', 'wankers', 'wank', 'bollocks',
  // Slurs
  'nigger', 'niggers', 'nigga', 'niggas',
  'faggot', 'faggots',
  'kike', 'kikes',
  'spic', 'spics',
  'chink', 'chinks',
  'gook', 'gooks',
  'retard', 'retards',
  'tranny', 'trannies',
];

const URL_RE    = /https?:\/\/|www\.\S|\.com\b|\.net\b|\.org\b/i;
const EMAIL_RE  = /\S+@\S+\.\S+/;
const REPEAT_RE = /(.)\1{6,}/;

export interface FieldError {
  field: string;
  message: string;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/8/g, 'b')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9\s]/g, ' ');
}

function containsBlockedWord(text: string): boolean {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  return words.some(w => (BLOCKLIST as string[]).includes(w));
}

export function validateSubmission(
  title: string,
  artist: string,
  album: string,
): FieldError[] {
  const errors: FieldError[] = [];
  const all = `${title} ${artist} ${album}`;

  if (!title?.trim()) {
    errors.push({ field: 'title', message: 'Song title is required.' });
  } else if (title.trim().length < 2) {
    errors.push({ field: 'title', message: 'Title is too short.' });
  } else if (title.length > 100) {
    errors.push({ field: 'title', message: 'Title is too long (max 100 characters).' });
  }

  if (!artist?.trim()) {
    errors.push({ field: 'artist', message: 'Artist name is required.' });
  } else if (artist.length > 100) {
    errors.push({ field: 'artist', message: 'Artist name is too long (max 100 characters).' });
  }

  if (album && album.length > 100) {
    errors.push({ field: 'album', message: 'Album name is too long (max 100 characters).' });
  }

  if (errors.length === 0) {
    if (URL_RE.test(all)) {
      errors.push({ field: 'title', message: 'Links are not allowed in submissions.' });
    } else if (EMAIL_RE.test(all)) {
      errors.push({ field: 'title', message: 'Email addresses are not allowed.' });
    } else if (REPEAT_RE.test(all)) {
      errors.push({ field: 'title', message: 'This submission looks like spam.' });
    } else if (containsBlockedWord(all)) {
      errors.push({ field: 'title', message: "This submission contains content we can't accept." });
    }
  }

  return errors;
}
