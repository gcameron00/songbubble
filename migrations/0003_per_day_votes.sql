-- Change vote uniqueness from "one per lyric ever" to "one per lyric per day".
--
-- A user's daily budget resets at midnight UTC, and they may vote for the same
-- lyric again on a new day. Each vote decays independently, so re-voting "tops
-- up" a lyric's score without wiping the previous contribution.
--
-- SQLite does not support adding a column to a UNIQUE index, so we recreate the
-- table using the recommended rename-and-replace approach.

CREATE TABLE votes_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lyric_id    INTEGER NOT NULL REFERENCES lyrics(id) ON DELETE CASCADE,
  fingerprint TEXT    NOT NULL,
  vote_day    TEXT    NOT NULL,             -- ISO date in UTC, e.g. '2026-03-08'
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Carry over existing votes, deriving vote_day from created_at.
INSERT INTO votes_new (id, lyric_id, fingerprint, vote_day, created_at)
SELECT id, lyric_id, fingerprint, DATE(created_at, 'unixepoch'), created_at
FROM votes;

DROP TABLE votes;
ALTER TABLE votes_new RENAME TO votes;

-- One vote per fingerprint per lyric per calendar day.
CREATE UNIQUE INDEX uq_vote         ON votes(lyric_id, fingerprint, vote_day);
CREATE        INDEX idx_votes_lyric ON votes(lyric_id);
CREATE        INDEX idx_votes_fp_time ON votes(fingerprint, created_at);
