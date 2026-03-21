# Apple Music Integration

## Overview

SongBubble integrates with Apple Music in two phases:

1. **Catalogue search** — users can find songs via Apple Music rather than typing manually. Selecting a result captures structured metadata and stores it in the SongBubble database.
2. **Playback** *(planned)* — users with an Apple Music subscription can play songs directly within SongBubble.

Both phases use **MusicKit JS**, Apple's official client-side library. No server-side Apple Music API calls are made during search or playback; the library handles everything in the browser once configured with a developer token.

---

## Phase 1 — Catalogue Search

### How it works

When a user types in the search box, SongBubble queries two sources in parallel:

- **SongBubble database** — `/api/songs?q=` returns matching songs already in the chart
- **Apple Music catalogue** — MusicKit JS searches Apple's catalogue for the same query

Results are shown in two sections:

| Section | Label | Behaviour |
|---|---|---|
| Already in SongBubble | Songs currently in the DB | Vote / nominate as normal |
| From Apple Music | Catalogue results not yet in DB | Upsert into DB first, then nominate |

Selecting an Apple Music result triggers a POST to `/api/songs` with the full metadata. Once saved, the song is treated identically to any other nomination.

### Metadata captured from Apple Music

| Field | Source (`MusicKit` attributes) |
|---|---|
| `title` | `attributes.name` |
| `artist` | `attributes.artistName` |
| `album` | `attributes.albumName` |
| `apple_music_id` | `id` (catalogue track ID) |
| `artwork_url` | `attributes.artwork.url` (with `{w}x{h}` substituted at cache time) |

The `apple_music_id` is used as an upsert key — nominating a song already in the DB (matched by Apple Music ID) will not create a duplicate.

### Artwork

Artwork URLs from Apple Music use a template format: `https://…/{w}x{h}bb.jpg`. SongBubble stores the templated URL and substitutes dimensions at render time. No separate caching step is needed for the URL itself; the `artwork_fetched_at` timestamp on the `songs` row records when it was last confirmed valid.

---

## Developer Token

MusicKit JS requires a **developer token** to authenticate the app with Apple's API. This is a signed JWT, not a user credential — it identifies SongBubble as an authorised app, not the individual user.

### Token structure

```
Header:  { alg: "ES256", kid: APPLE_KEY_ID }
Payload: { iss: APPLE_TEAM_ID, iat: <now>, exp: <now + 6 months> }
```

Signed with `APPLE_MUSIC_PRIVATE_KEY` (the `.p8` file contents).

### Where the token lives

A Cloudflare Pages Function at `/api/apple-music/token` generates and returns a signed JWT on request. The client fetches this token on page load and passes it to `MusicKit.configure()`.

The token endpoint checks the request `Origin` header against `APPLE_MUSIC_ORIGIN` and returns 403 if it doesn't match — preventing other sites from using SongBubble's developer token.

The token itself is not secret (it is visible in the browser), but the private key used to sign it never leaves the server.

### Required Apple Developer setup

1. Sign in to [developer.apple.com](https://developer.apple.com)
2. Create a **MusicKit identifier** under Certificates, Identifiers & Profiles → Identifiers → Music IDs
3. Generate a **MusicKit key** (.p8) — download once; store securely
4. Note the **Key ID** and **Team ID**

### Configuration

`APPLE_MUSIC_PRIVATE_KEY` is the only sensitive value — store it as a Cloudflare secret:

```
wrangler secret put APPLE_MUSIC_PRIVATE_KEY
```

The remaining values are non-sensitive and go in `wrangler.toml` under `[vars]` (they are visible in the JWT the client receives anyway):

```toml
[vars]
APPLE_TEAM_ID        = "YOUR_TEAM_ID"
APPLE_KEY_ID         = "YOUR_KEY_ID"
APPLE_MUSIC_ORIGIN   = "https://yourdomain.com"
```

For local development, override these in `.dev.vars` (gitignored):

```
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_MUSIC_PRIVATE_KEY=<contents of .p8 file>
APPLE_MUSIC_ORIGIN=http://localhost:8788
```

---

## Client-side Flow

```
Page load
  └─ fetch /api/apple-music/token
  └─ MusicKit.configure({ developerToken, app: { name: 'SongBubble' } })

User types in search box
  ├─ fetch /api/songs?q=<query>          → "Already in SongBubble" results
  └─ MusicKit.getInstance().api.music(  → "From Apple Music" results
       /v1/catalog/{storefront}/search,
       { term: query, types: 'songs', limit: 10 }
     )

User selects Apple Music result
  └─ POST /api/songs { title, artist, album, apple_music_id, artwork_url }
  └─ server upserts song, returns song_id
  └─ proceed to nomination / vote as normal
```

---

## Phase 2 — Playback *(planned)*

MusicKit JS supports authenticated playback for users with an active Apple Music subscription. No additional server-side changes are needed for this phase.

### Flow

1. User clicks a play button on a chart entry that has an `apple_music_id`
2. If MusicKit is not yet authorised: `await music.authorize()` — Apple's sign-in sheet appears
3. Once authorised: `await music.setQueue({ song: apple_music_id })` then `music.play()`
4. Playback happens entirely within the browser via MusicKit JS

### UI considerations

- Play buttons only appear on songs that have an `apple_music_id`
- The authorisation prompt is triggered on first play attempt, not on page load
- A persistent "Connected to Apple Music" indicator can be shown once authorised

---

## Files to create / modify

| File | Change |
|---|---|
| `functions/api/apple-music/token.ts` | New — generates and returns the signed MusicKit JWT |
| `functions/api/songs.ts` | Update POST to accept and upsert by `apple_music_id` |
| `index.html` | Load MusicKit JS from Apple CDN; fetch token on boot |
| `assets/js/main.js` | Parallel search; merged results UI; Apple Music song selection handler |
| `assets/js/submit.js` | Pass `apple_music_id` + `artwork_url` when creating from catalogue |

No database migration is required — `apple_music_id` and `artwork_url` columns already exist on the `songs` table.
