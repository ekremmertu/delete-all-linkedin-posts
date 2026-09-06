# Contributing

Thanks for looking. This is a small extension with one job, so contributing is
short work.

## The most useful thing you can do

**Tell me when it breaks.** LinkedIn changes its markup without warning, and I
only see it break on my own account, in my own interface language. A single issue
saying "the delete row is not found on German LinkedIn since last week" is worth
more than most pull requests.

Open an issue with:

- Your browser and version (Chrome 141, Brave 1.7x, …)
- **Your LinkedIn interface language** — this matters more than anything else
- What the popup showed (the counter, any error line)
- What you expected instead

## Running it locally

There is no build step. It is plain Manifest V3 — HTML, CSS and JavaScript.

1. Clone the repo.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → pick the repo folder.
4. After editing, hit the reload arrow on the extension card, then reload the
   LinkedIn tab.

Test on your own activity page: `linkedin.com/in/<you>/recent-activity/all/`

**Always test in Count first mode.** It touches nothing. Only switch to Delete
when you genuinely intend to lose those posts — there is no undo.

## Where the fragile parts are

Everything that can break lives in `content.js`:

| Function / constant | What it finds |
|---|---|
| `MENU_SECICI` | the "…" button on each post card |
| `silSatiri()` | the delete row inside the open menu |
| `onayDugmesi()` | the confirm button in the modal |

Each one tries a stable CSS class first and falls back to matching text. **Keep
that order.** A text-only match works on English LinkedIn and fails silently
everywhere else — that is exactly the bug this project exists to avoid.

If you add a text fallback, add it for more than one language.

## Pull requests

- One change per PR. A selector fix and a UI redesign do not travel together.
- Say which browser and which LinkedIn interface language you tested on. A PR
  without that line cannot be reviewed honestly.
- Match the surrounding style. There is no linter and no formatter; just don't
  reformat files you aren't changing.
- Identifiers in `content.js` are partly Turkish (`silSatiri`, `onayDugmesi`).
  That is historical. Leave them alone unless a PR renames all of them at once.

## What I will not merge

- Anything that touches other people's content, or anyone's account but your own
- Network requests, analytics, telemetry — the "nothing leaves your browser"
  claim in the README has to stay literally true
- Speeding up the delay past a few seconds per post. The slowness is a feature:
  it keeps you under LinkedIn's rate limits and off its radar.
- Broad host permissions. `linkedin.com` only.

## License

By contributing you agree your work ships under the [MIT License](LICENSE).
