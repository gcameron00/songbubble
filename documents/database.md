# Database

LyricBubble uses [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite-compatible) as its database. It is bound to the Pages Functions runtime as `env.DB`.

## Tables

### `lyrics`

Stores the pool of lyric lines available for voting.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER` | Primary key, auto-incremented |
| `text` | `TEXT` | The lyric line |
| `artist` | `TEXT` | Artist name |
| `song` | `TEXT` | Song title |
| `created_at` | `INTEGER` | Unix timestamp (seconds), defaults to `unixepoch()` at insert time |

### `votes`

Records one vote per user fingerprint per lyric per calendar day.

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER` | Primary key, auto-incremented |
| `lyric_id` | `INTEGER` | Foreign key → `lyrics.id` (cascades on delete) |
| `fingerprint` | `TEXT` | Anonymous user token from the `lb_fp` cookie |
| `vote_day` | `TEXT` | ISO date in UTC (e.g. `2026-03-08`) — scopes uniqueness to one day |
| `created_at` | `INTEGER` | Unix timestamp (seconds), defaults to `unixepoch()` at insert time |

## Relationships

```
lyrics ──< votes
  (one lyric can have many votes)
```

`votes.lyric_id` references `lyrics.id`. If a lyric is deleted, its votes are deleted automatically (`ON DELETE CASCADE`).

## Indexes

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `uq_vote` | `votes` | `(lyric_id, fingerprint, vote_day)` | One vote per user per lyric per day |
| `idx_votes_lyric` | `votes` | `(lyric_id)` | Speeds up the leaderboard join |
| `idx_votes_fp_time` | `votes` | `(fingerprint, created_at)` | Speeds up the daily budget check |

## Voting rules

- A user gets **5 votes per calendar day** (UTC midnight reset).
- They may vote for the **same lyric on multiple days** — each vote decays independently, so re-voting tops up the score.
- A vote cast **today** can be retracted; votes from previous days cannot.
- Uniqueness is enforced at the database level via `uq_vote`.

## Vote states (UI)

| State | Condition | Button appearance |
|---|---|---|
| Never voted | No entry in `lb_voted` | Empty heart ♡ |
| Previously voted (not today) | `lb_voted[id]` is a past date | Light purple border — can vote again |
| Voted today | `lb_voted[id]` equals today's date | Filled heart ♥ — hover shows ✕ to retract |

## Scoring and decay

The leaderboard score for each lyric is calculated at query time — no stored scores. Each vote contributes a decayed value based on its age:

```sql
SUM(MAX(0.0, 1.0 - (unixepoch() - v.created_at) / 604800.0))
```

- A vote cast now contributes `1.0`
- A vote cast 3.5 days ago contributes `0.5`
- A vote cast 7 or more days ago contributes `0.0` (fully decayed)

Because votes decay rather than expire instantly, re-voting for a lyric compounds its score — an older vote still contributes something while the new vote starts fresh at `1.0`.

## Migrations

Migrations live in [`/migrations`](/migrations/) as numbered `.sql` files and are applied via Wrangler.

| File | Description |
|---|---|
| `0001_initial.sql` | Creates the `lyrics` and `votes` tables and all indexes |
| `0002_seed.sql` | Inserts 10 starter lyrics for development |
| `0003_per_day_votes.sql` | Adds `vote_day` column; changes uniqueness to per-lyric-per-day |

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
| `GET` | `/api/lyrics` | Leaderboard: top lyrics ordered by decayed score. Query params: `limit` (default 10), `decay` (window in seconds, default 604800) |
| `POST` | `/api/lyrics` | Insert a new lyric. Body: `{ text, artist, song }` |
| `GET` | `/api/votes` | Returns `{ voted_today: […], voted_ever: […] }` — lyric IDs the current browser has voted for today, and all-time. Used on page load to reconcile localStorage with the server |
| `POST` | `/api/votes` | Cast a vote. Body: `{ lyric_id }`. Sets the `lb_fp` fingerprint cookie if absent |
| `DELETE` | `/api/votes` | Retract today's vote. Body: `{ lyric_id }`. Only works for votes cast on the current UTC day |

### Debug (BubbleTrouble)

These endpoints power the [`/bubbletrouble/`](/bubbletrouble/) internal dashboard. They are not authenticated — access relies on the URL being unlisted.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/debug/stats` | Summary counts: `lyrics_count`, `votes_count`, `votes_today`, `unique_fingerprints` |
| `GET` | `/api/debug/lyrics?page=1` | Paginated lyrics table ordered by ID, with current decay score. 25 rows per page |
| `GET` | `/api/debug/votes?page=1` | Paginated votes table, newest first. Fingerprints truncated to 8 chars. 25 rows per page |
| `POST` | `/api/debug/clean-votes` | Deletes all rows from the `votes` table. Lyrics are preserved. Returns `{ ok, deleted }` |
| `POST` | `/api/debug/reset` | Deletes all rows from both `votes` and `lyrics`. Returns `{ ok, votes_deleted, lyrics_deleted }` |

## BubbleTrouble dashboard

An internal debugging hub accessible at [`/bubbletrouble/`](/bubbletrouble/). It is not linked from the public navigation.

| Page | Path | Description |
|---|---|---|
| Overview | `/bubbletrouble/` | Live stats, table view shortcuts, and database utility actions |
| Lyrics table | `/bubbletrouble/lyrics/` | Paginated view of all lyric rows with decay scores |
| Votes table | `/bubbletrouble/votes/` | Paginated view of all vote rows, newest first |

### Utility actions

Both utility actions require a two-step confirmation: click the action button, then type the confirmation word into the text field before the execute button becomes active.

| Action | Endpoint | Effect |
|---|---|---|
| Wipe voting data | `POST /api/debug/clean-votes` | Empties the `votes` table; lyrics and their text are kept |
| Full database reset | `POST /api/debug/reset` | Empties both `votes` and `lyrics`; the chart will be empty until new lyrics are added |
