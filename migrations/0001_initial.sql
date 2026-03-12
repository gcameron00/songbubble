-- LyricBubble — initial schema
-- Apply locally:  npm run db:migrate:local
-- Apply remotely: npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS lyrics (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  text       TEXT    NOT NULL,
  artist     TEXT    NOT NULL,
  song       TEXT    NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS votes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lyric_id    INTEGER NOT NULL REFERENCES lyrics(id) ON DELETE CASCADE,
  -- Anonymous user token stored in a cookie (lb_fp). Never linked to an identity.
  fingerprint TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- One vote per fingerprint per lyric (enforced at DB level).
CREATE UNIQUE INDEX IF NOT EXISTS uq_vote ON votes(lyric_id, fingerprint);

-- Speed up the leaderboard query.
CREATE INDEX IF NOT EXISTS idx_votes_lyric ON votes(lyric_id);
CREATE INDEX IF NOT EXISTS idx_votes_fp_time ON votes(fingerprint, created_at);
