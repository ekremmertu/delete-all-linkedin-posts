# Security

## What this extension can reach

- **Host permissions:** `https://www.linkedin.com/*` only. It cannot see any
  other site.
- **Content script:** injected only on `https://www.linkedin.com/in/*`.
- **Permissions:** `storage` only (progress across page reloads).
- **Network:** none. The extension makes no requests of its own — no servers, no
  analytics, no telemetry. Nothing leaves your browser.

You can verify all of the above in [`manifest.json`](manifest.json); it is about
30 lines.

## Reporting a vulnerability

If you find something that lets this extension read or change data it should not
— other sites, other accounts, anything leaving the browser — please report it
privately rather than opening a public issue:

**GitHub → Security → [Report a vulnerability](https://github.com/ekremmertu/delete-all-linkedin-posts/security/advisories/new)**

Include what you found, how to reproduce it, and what an attacker could do with
it. I will confirm receipt and tell you what I intend to do about it.

Please don't test against anyone's account but your own.

## Supported versions

Only the latest commit on `main` is supported. There is no backporting; if
something is broken, the fix goes on `main`.
