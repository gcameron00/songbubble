# Database

SongBubble uses [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite-compatible) as its database, bound to the Pages Functions runtime as `env.DB`.

## Tables

### `songs`

Stores the pool of songs available for voting.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER` | Primary key, auto-incremented |
| `title` | `TEXT` | Song title |
| `artist` | `TEXT` | Artist name |
| `album` | `TEXT` | Album name (nullable) |
| `artwork_url` | `TEXT` | Cached artwork URL from catalogue API (nullable) |
| `artwork_fetched_at` | `INTEGER` | Unix timestamp of last successful artwork fetch (nullable) |
| `spotify_id` | `TEXT` | Spotify catalogue ID stub (nullable) |
| `apple_music_id` | `TEXT` | Apple Music catalogue ID stub (nullable) |
| `created_at` | `INTEGER` | Unix timestamp (seconds), defaults to `unixepoch()` at insert time |

### `votes`

Records one vote per user fingerprint per song per calendar day.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER` | Primary key, auto-incremented |
| `song_id` | `INTEGER` | Foreign key → `songs.id` (cascades on delete) |
| `fingerprint` | `TEXT` | Anonymous user token from the `sb_fp` cookie |
| `vote_day` | `TEXT` | ISO date in UTC (e.g. `2026-03-14`) — scopes uniqueness to one day |
| `created_at` | `INTEGER` | Unix timestamp (seconds), defaults to `unixepoch()` at insert time |

## Relationships

```
songs ──< votes
  (one song can have many votes)
```

`votes.song_id` references `songs.id`. If a song is deleted, its votes are deleted automatically (`ON DELETE CASCADE`).

## Indexes

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `uq_vote` | `votes` | `(song_id, fingerprint, vote_day)` | One vote per user per song per day |
| `idx_votes_song` | `votes` | `(song_id)` | Speeds up the leaderboard join |
| `idx_votes_fp_time` | `votes` | `(fingerprint, created_at)` | Speeds up the daily budget check |
| `idx_songs_artwork_fetched` | `songs` | `(artwork_fetched_at)` | Speeds up stale artwork cache queries |

## Voting rules

- A user gets **5 votes per calendar day** (UTC midnight reset).
- They may vote for the **same song on multiple days** — each vote decays independently, so re-voting tops up the score.
- A vote cast **today** can be retracted; votes from previous days cannot.
- Uniqueness is enforced at the database level via `uq_vote`.

## Vote states (UI)

| State | Condition | Button appearance |
|---|---|---|
| Never voted | No entry in `sb_voted` | Empty heart ♡ |
| Previously voted (not today) | `sb_voted[id]` is a past date | Light purple border — can vote again |
| Voted today | `sb_voted[id]` equals today's date | Filled heart ♥ — hover shows ✕ to retract |

## Scoring and decay

The leaderboard score for each song is calculated at query time — no stored scores. Each vote contributes a decayed value based on its age:

```sql
SUM(MAX(0.0, 1.0 - (unixepoch() - v.created_at) / 2419200.0))
```

- A vote cast now contributes `1.0`
- A vote cast 14 days ago contributes `0.5`
- A vote cast 28 or more days ago contributes `0.0` (fully decayed)

Because votes decay rather than expire instantly, re-voting for a song compounds its score — an older vote still contributes something while the new vote starts fresh at `1.0`.

## Artwork caching

`artwork_url` and `artwork_fetched_at` are populated when catalogue integration (Apple Music / Spotify) fetches artwork for a song. Re-fetch when `artwork_fetched_at` is `NULL` or older than your desired TTL.

## Migrations

Migrations live in [`/migrations`](/migrations/) as numbered `.sql` files and are applied via Wrangler.

| File | Description |
|---|---|
| `0001_initial.sql` | Creates the original `lyrics` and `votes` tables |
| `0002_seed.sql` | Inserts 10 starter rows for development (lyric era) |
| `0003_per_day_votes.sql` | Adds `vote_day`; changes uniqueness to per-lyric-per-day |
| `0004_songs_schema.sql` | Migrates `lyrics` → `songs`; adds `album`, artwork cache, and catalogue ID columns; renames `lyric_id` → `song_id` in votes |
| `0005_seed.sql` | Replaces seed data with 105 songs spanning the 1960s–2020s |

```bash
# Apply to local database
npm run db:migrate:local

# Apply to production database
npm run db:migrate:remote
```

## API endpoints

All endpoints are implemented as Cloudflare Pages Functions in [`/functions/api`](/functions/api/).

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Returns `{ ok: true }` — liveness check |
| `GET` | `/api/songs` | Top 10 songs ordered by decay-weighted score |
| `GET` | `/api/songs?q=…` | Full-catalogue search across title, artist, and album (up to 50 results) |
| `POST` | `/api/songs` | Submit a new song. Body: `{ title, artist, album? }` |
| `GET` | `/api/votes` | Returns `{ voted_today: […], voted_ever: […] }` — song IDs the current browser has voted for today and all-time |
| `POST` | `/api/votes` | Cast a vote. Body: `{ song_id }`. Sets the `sb_fp` fingerprint cookie if absent |
| `DELETE` | `/api/votes` | Retract today's vote. Body: `{ song_id }`. Only works for votes cast on the current UTC day |

### Debug (BubbleTrouble)

These endpoints power the [`/bubbletrouble/`](/bubbletrouble/) internal dashboard. They are not authenticated — access relies on the URL being unlisted.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/debug/stats` | Summary counts: `songs_count`, `votes_count`, `votes_today`, `unique_fingerprints` |
| `GET` | `/api/debug/songs?page=1` | Paginated songs table ordered by ID, with current decay score. 25 rows per page |
| `GET` | `/api/debug/votes?page=1` | Paginated votes table, newest first. Fingerprints truncated to 8 chars. 25 rows per page |
| `POST` | `/api/debug/clean-votes` | Deletes all rows from the `votes` table. Songs are preserved. Returns `{ ok, deleted }` |
| `POST` | `/api/debug/reset` | Deletes all rows from both `votes` and `songs`. Returns `{ ok, votes_deleted, songs_deleted }` |

## BubbleTrouble dashboard

An internal debugging hub accessible at [`/bubbletrouble/`](/bubbletrouble/). Not linked from the public navigation.

| Page | Path | Description |
|---|---|---|
| Overview | `/bubbletrouble/` | Live stats, table view shortcuts, and database utility actions |
| Songs table | `/bubbletrouble/songs/` | Paginated view of all song rows with decay scores |
| Votes table | `/bubbletrouble/votes/` | Paginated view of all vote rows, newest first |

### Utility actions

Both actions require a two-step confirmation: click the action button, then type the confirmation word before the execute button becomes active.

| Action | Endpoint | Effect |
|---|---|---|
| Wipe voting data | `POST /api/debug/clean-votes` | Empties the `votes` table; songs are kept |
| Full database reset | `POST /api/debug/reset` | Empties both `votes` and `songs`; the chart will be empty until songs are added |
