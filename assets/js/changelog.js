/**
 * SongBubble changelog — single source of truth.
 *
 * Both index.html (splash dialog) and about/changelog/index.html read this file.
 * Newest entry first. Version format: YYYY.NNN (zero-padded, resets each year).
 * Lexicographic comparison works correctly with this format.
 *
 * See CLAUDE.md for guidance on when to add an entry and bump the version.
 */

const CHANGELOG_VERSION = '2026.001';

const CHANGELOG = [
  {
    version: '2026.001',
    date: '2026-03-29',
    title: 'Launch',
    items: [
      'Community chart — vote for the songs you love most right now',
      'Votes fade over 28 days so the chart stays fresh',
      'Search and discover songs via Apple Music',
      'Preview playback directly from the chart',
    ],
  },
];
