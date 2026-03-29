# SongBubble

SongBubble is a community-driven song voting site that surfaces what people are listening to and loving right now. Users nominate songs and vote for their current favourites; votes fade over time so the chart stays fresh.
 
**How it works**

- Users nominate songs (title, artist, optional album)
- Each user gets a limited number of votes per day, spread across the chart
- Votes decay over time — last month's favourite doesn't crowd out what's resonating today
- The chart shows all songs with active votes, ranked by score, with infinite scroll
- Album artwork is displayed throughout the chart

**Apple Music integration**

- Search the Apple Music catalogue to find and nominate songs
- In-page preview playback for songs with an Apple Music match

See [documents/apple-music-integration.md](documents/apple-music-integration.md) for the Apple Music integration design.

**Quick Start**

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the local dev server (Cloudflare Pages + D1).

**Project structure (high level):**

- `index.html` — main chart / home page
- `about/index.html` — about page
- `about/changelog/index.html` — changelog history
- `assets/css/styles.css` — styles
- `assets/js/changelog.js` — version history data (bump this when shipping user-facing changes)
- `functions/` — Cloudflare Pages Functions (API routes)
- `migrations/` — D1 SQL migrations

**Development notes**

- Hosted on Cloudflare Pages with a D1 database (`songbubble-db`)
- Use `npm run db:migrate:local` / `npm run db:migrate:remote` to apply migrations
- BubbleTrouble debug dashboard available at `/bubbletrouble/` (not linked publicly)
- To contribute, open an issue or submit a pull request
