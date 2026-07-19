# Changelog

## [0.4.12] - 2026-07-19

### Current functionality

- Synchronizes decisions, risks, issues, and executive follow-ups.
- Creates and updates managed record notes.
- Resolves person links and aliases through Obsidian.
- Synchronizes record relationships to People pages.
- Supports compact inline status values such as `s::o` and `s::d`.
- Normalizes closed, complete, and done states to Done.
- Adds completion dates and strikethrough formatting to completed records.
- Synchronizes status changes made in record pages and People pages back to source notes.
- Generates and maintains the configured Knowledge OS Base dashboard.
- Tracks configured folders when folders are renamed.
- Provides preview, batch synchronization, auto-detection, and undo commands.

### Development foundation

- Added TypeScript source project.
- Added esbuild production and watch builds.
- Added package metadata, TypeScript configuration, version synchronization, and Git exclusions.
