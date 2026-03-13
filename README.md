# SongBubble

SongBubble is a simple, user-driven song voting site that surfaces favourite songs. Users vote for the songs they like most; votes are limited and fade over time so the chart stays current.

**Features:**

- Vote on songs; votes decay over time
- Top 10 homepage chart
- Search by song title or artist
- Minimal user data collection and low hosting costs

**Quick Start**

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the local dev server (Cloudflare Pages + D1).

**Project structure (high level):**

- `index.html` — main entry
- `about/index.html` — about page
- `assets/css/styles.css` — styles
- `functions/` — Cloudflare Pages Functions (API routes)
- `migrations/` — D1 SQL migrations

**Development notes**

- Hosted on Cloudflare Pages with a D1 database (`songbubble-db`)
- Use `npm run db:migrate:local` / `npm run db:migrate:remote` to apply migrations
- BubbleTrouble debug dashboard available at `/bubbletrouble/` (not linked publicly)
