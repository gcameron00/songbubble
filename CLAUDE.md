# SongBubble — developer notes

## Changelog & versioning

The changelog lives in `assets/js/changelog.js`. It is loaded by both `index.html`
(for the splash dialog) and `about/changelog/index.html` (the full history page).

### Version format

`YYYY.NNN` — e.g. `2026.001`. The counter is zero-padded to three digits and
increments per release. It resets to `001` each calendar year.
Lexicographic comparison works correctly with this format.

### When to add an entry

Only add entries for **user-facing changes**:

| Add an entry | Skip it |
|---|---|
| New feature | Bug fix restoring expected behaviour |
| Meaningful UI change | Styling tweak |
| Voting rule change | Internal refactor |
| New page or section | Security hardening |

When in doubt, propose a bump and let the human decide.

### How to add an entry

1. Add a new object to the **top** of the `CHANGELOG` array in `assets/js/changelog.js`.
2. Bump `CHANGELOG_VERSION` to match the new entry's `version`.

```js
{
  version: '2026.002',
  date: 'YYYY-MM-DD',       // today's date
  title: 'Short release title',
  items: [
    'User-facing change one',
    'User-facing change two',
  ],
},
```

Do not edit older entries unless correcting a factual error.
