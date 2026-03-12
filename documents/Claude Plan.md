Plan: Pivot from LyricBubble to a songs-focused concept

Context

The LyricBubble prototype is being archived in place — the live Cloudflare Pages deployment stays online as a demo. A new project will take the same codebase and repurpose it around songs rather than lyric lines. Most of the stack (Cloudflare Pages + D1 + Workers, voting decay algorithm, UI patterns, CSS design tokens) is being reused.



The question is how to branch off without disturbing the archived site.



Recommendation: Fork on GitHub

Why fork rather than branch:



The current repo is named lyricbubble — a new name better signals the pivot to anyone reading the code or finding the site.

The archived prototype must stay deployed at its current Cloudflare Pages URL. A fork keeps that repo and its Pages deployment completely independent; there's no risk of accidentally touching it later.

Forks preserve the full git history (all the D1 setup, voting logic, animation work) so nothing is lost, but the two projects evolve independently from day one.

A branch in the same repo would still be named lyricbubble, share the same Pages project config, and create confusion about which branch deploys where.

Why not a new empty repo:



You'd lose the git history and have to manually copy files, which is error-prone. The working Wrangler config, migrations, and function structure are worth inheriting cleanly.

Steps

1\. Fork on GitHub

Go to github.com/gcameron00/lyricbubble → Fork

Name the new repo (e.g. songbubble — or whatever name fits the new concept)

The original repo and its Cloudflare Pages deployment are untouched from this point

2\. Clone the fork locally

git clone https://github.com/gcameron00/songbubble

cd songbubble

3\. Strip the archived-prototype UI from the fork

Remove from the new project (these were added specifically for the archive):



Splash screen (#splash div + inline script) from index.html

Sash (.sash-wrap) from index.html and about/index.html

.sash-\*, #splash, .splash-\*, .about-status CSS from styles.css

4\. Create a new Cloudflare Pages project

In the Cloudflare dashboard, connect the new GitHub repo as a new Pages project

This gives the new site its own deployment URL and is fully separate from the archived one

5\. Create a new D1 database

npx wrangler d1 create songbubble-db

Update wrangler.jsonc with the new database ID

Run migrations against the new DB (npm run db:migrate:local, then remote)

6\. Begin the concept pivot

The main data-model change: the lyrics table currently stores (text, artist, song). For a songs-focused chart the key question is what a "song entry" looks like — likely (title, artist, album?, year?) — and what users vote on (the song itself rather than a line). The voting, decay, budget, FLIP animation, and BubbleTrouble tooling all transfer as-is.



What stays the same (no changes needed)

All of functions/api/votes.ts — voting logic is identical

functions/api/debug/\* — BubbleTrouble works for any chart

assets/css/styles.css design tokens and layout

assets/js/main.js voting/FLIP/reconcile logic (minor field name tweaks only)

migrations/0001\_initial.sql schema (rename table/columns as needed)

wrangler.jsonc structure, tsconfig.json, package.json scripts

What changes

migrations/ — new migration to rename/reshape the table for songs

functions/api/lyrics.ts → rename to songs.ts, update field names

index.html / about/index.html — new copy, new title

assets/data/taglines.json — new phrases for the song concept

assets/js/submit.js — form fields change (no lyric text field; possibly album/year)

README.md — update for new project

Verification

npx wrangler pages dev . loads the new site cleanly (no splash/sash)

Chart loads from the new D1 database

Voting, retraction, and FLIP animation all work

BubbleTrouble hub shows correct stats for the new DB

Original lyricbubble Cloudflare Pages URL still serves the archived prototype unaffected

