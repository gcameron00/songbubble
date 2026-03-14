-- SongBubble — migrate from lyrics model to songs model.
--
-- Changes:
--   • Rename `lyrics` table to `songs`; drop lyric `text` column; rename `song` column to `title`
--   • Add `album`, `artwork_url`, `artwork_fetched_at` (catalogue artwork cache),
--     `spotify_id`, and `apple_music_id` (stub columns for future catalogue integration)
--   • Rename `lyric_id` → `song_id` in the votes table
--   • Update anonymous fingerprint cookie reference: lb_fp → sb_fp (handled in application code)
--
-- Apply locally:  npm run db:migrate:local
-- Apply remotely: npm run db:migrate:remote

-- ── 1. Create new songs table ─────────────────────────────────────────────────

CREATE TABLE songs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  title              TEXT    NOT NULL,
  artist             TEXT    NOT NULL,
  album              TEXT,
  -- Catalogue artwork: URL cached from Apple Music / Spotify to avoid repeated API calls.
  -- Re-fetch when artwork_fetched_at is NULL or older than your desired TTL.
  artwork_url        TEXT,
  artwork_fetched_at INTEGER,                 -- unix timestamp of last successful fetch
  -- Catalogue IDs — stub columns, populated when catalogue search is integrated.
  spotify_id         TEXT,
  apple_music_id     TEXT,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── 2. Migrate existing rows from lyrics → songs ──────────────────────────────

INSERT INTO songs (id, title, artist, created_at)
SELECT id, song, artist, created_at
FROM lyrics;

-- ── 3. Rebuild votes table with song_id ───────────────────────────────────────

CREATE TABLE votes_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id     INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  -- Anonymous user token stored in a cookie (sb_fp). Never linked to an identity.
  fingerprint TEXT    NOT NULL,
  vote_day    TEXT    NOT NULL,             -- ISO date in UTC, e.g. '2026-03-14'
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO votes_new (id, song_id, fingerprint, vote_day, created_at)
SELECT id, lyric_id, fingerprint, vote_day, created_at
FROM votes;

DROP TABLE votes;
ALTER TABLE votes_new RENAME TO votes;

-- One vote per fingerprint per song per calendar day.
CREATE UNIQUE INDEX uq_vote           ON votes(song_id, fingerprint, vote_day);
CREATE        INDEX idx_votes_song    ON votes(song_id);
CREATE        INDEX idx_votes_fp_time ON votes(fingerprint, created_at);

-- ── 4. Drop old lyrics table ──────────────────────────────────────────────────

DROP TABLE lyrics;

-- ── 5. Speed up artwork re-fetch queries ──────────────────────────────────────

CREATE INDEX idx_songs_artwork_fetched ON songs(artwork_fetched_at);
