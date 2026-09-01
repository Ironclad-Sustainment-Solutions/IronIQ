# IronIQ Edge changelog

Versioning: each downloadable build is tagged with the short git commit
it was built from (run `./ironiq-edge --version` to check, or see
`/downloads/VERSION.txt` in the app), not a semantic version number --
there's no separate release/tagging process yet, every merge to `main`
that touches `edge/` produces a new build automatically. This file
tracks what's actually changed in terms customers and support can use,
not a commit-by-commit log (see git history for that).

## Current

- MTConnect support for Haas NGC controls (read-only, `GET /current`),
  the primary supported path today.
- Per-machine protocol selection (`"protocol": "mtconnect"` or
  `"focas"`), for a fleet that mixes Haas and Fanuc controls.
- **FOCAS (Fanuc) support is experimental and unverified against real
  hardware** -- see the setup guide's Fanuc section before attempting
  this on a live machine.
- Per-facility ingest keys (not a global shared secret) -- a compromised
  key only ever affects the one facility it belongs to.
- Durable local buffering and automatic retry if IronIQ is briefly
  unreachable.
- SHA-256 checksums published alongside every download
  (`/downloads/CHECKSUMS.txt`) so a download's integrity can be verified
  independently of code signing.
- Not yet code-signed (Windows Authenticode / macOS notarization) --
  planned, not yet done. See the setup guide for what to expect from
  your OS in the meantime and how to verify a download without it.

## Known gaps

- No automatic update mechanism -- check `/downloads/VERSION.txt`
  periodically and re-download if you need a newer build.
- FOCAS struct layouts in `edge/focas/focas.go` are a best-effort
  reconstruction from Fanuc's public documentation, not verified against
  Fanuc's real header. Needs an engineer with real Fanuc access before
  it's trusted in production.
