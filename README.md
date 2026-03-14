# SongBubble

SongBubble is a community-driven song voting site that surfaces what people are listening to and loving right now. Users nominate songs and vote for their current favourites; votes fade over time so the chart stays fresh.

**How it works**

- Users nominate songs (title, artist, optional album)
- Each user gets a limited number of votes per day, spread across the chart
- Votes decay over time — last month's favourite doesn't crowd out what's resonating today
- The main chart shows the current Top 10; historic charts are also available
- Higher-placed songs display album artwork

**Planned features**

- Music catalogue search via Apple Music and Spotify — find songs without typing manually
- Playback integration for users with Apple Music or Spotify accounts

**Quick Start**

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the local dev server (Cloudflare Pages + D1).

**Project structure (high level):**

- `index.html` — main chart / home page
- `about/index.html` — about page
- `assets/css/styles.css` — styles
- `functions/` — Cloudflare Pages Functions (API routes)
- `migrations/` — D1 SQL migrations

**Development notes**

- Hosted on Cloudflare Pages with a D1 database (`songbubble-db`)
- Use `npm run db:migrate:local` / `npm run db:migrate:remote` to apply migrations
- BubbleTrouble debug dashboard available at `/bubbletrouble/` (not linked publicly)
- To contribute, open an issue or submit a pull request
