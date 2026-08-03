# Changelog

## [0.6.0] - 2026-08-02

### Added

- Added a new `a::` record type (Actions) for tasks delegated to other people, parallel to `d::`/`r::`/`i::`/`e::`, with its own configurable folder.
- Added Executive Meeting Mode: a side panel (ribbon icon or `Toggle Meeting Panel` command) with:
  - Quick Capture: type a line with a `d::`/`r::`/`i::`/`e::`/`a::` prefix (or plain text) and press Enter to append it to the active note, auto-append the detected owner's link and `s::o`, and sync immediately. Direct capture commands per type prefill the input.
  - Smart Owner Detection: reads `owner`/`people`/`participants` frontmatter on the active note to populate an owner dropdown, excluding a configured "your person note" from the candidate list.
  - Live per-type record counters for the active note; clicking a counter highlights all matching lines in the editor.
  - Open Items list scoped to the selected owner (or vault-wide when no owner is selected), with text search, a complete checkbox that marks the record Done and strikes the source line, and click-to-navigate that scrolls to and flashes the matching source line.
- Added auto-linking generalization: records can now resolve `project`/`program`/`capability`/`meeting` wikilinks (configurable via `autoLinkTypes`) into record note frontmatter, in addition to the existing person/owner resolution. Only links to existing notes are resolved; nothing is auto-created.
- Added an optional Priority field (off by default) for record notes and the dashboard Base, with a configurable level list; the value is preserved across resyncs.
- Added Meeting Mode settings: your person note, auto-open for meeting notes, remember last owner, remember last category, show live counters, focus after save.
- The dashboard Base's type filters and per-type views are now generated dynamically from all configured record types instead of a hardcoded list, so new types (like Actions) appear automatically in newly created Base files. Existing Base files are never overwritten, so a dashboard created before this update needs `- 'type == "action"'` added to its filters manually to surface Actions.
- Added Meeting Mode search-by-person: a vault-wide person lookup in the Open Items list, independent of the active note's detected owner, with results grouped by record type under colored type headings.
- Added colored inline highlighting for `d::`/`r::`/`i::`/`e::`/`a::` markers (grey/pink/yellow/green/blue) in both edit mode and reading view, so record types are easier to spot while scanning a note. The same colors are shown in the settings tab's syntax reference table.
- Added a due-date `EditorSuggest`: typing `[` on a line that starts with a record marker offers a `due::` suggestion; selecting it opens a small date-picker dialog (with Today/Tomorrow/Next week shortcuts) and inserts `[due:: YYYY-MM-DD]`. The due date is parsed out of the record's sentence, synced to the record note's `due` frontmatter field, and added as a column in the dashboard Base (existing Base files need `due` added to their properties/order manually to see it).

## [0.5.0] - 2026-07-19

### Added

- Added the ACE2X Environment Validator.
- Checks whether Dataview, Tasks, Templater, and Meta Bind are installed and enabled.
- Checks configured People, Executive, Decisions, Risks, Issues, and Dashboard folders.
- Checks the configured person template and dashboard Base name.
- Added a detailed validation modal with corrective actions.
- Added a settings summary and a Validate ACE2X environment command.
- Validation is advisory and never blocks ACE2X synchronization.
- Users remain free to select and name their own vault folders.

### Included from the v0.5.0 development cycle

- Default dashboard Base name is now `00.🎛️ Master`.
- Supports `s::o`, `s::d`, and `s::c` compact status values.
- Normalizes done, closed, complete, completed, and resolved to Done.
- Adds completion dates and strikethrough formatting for completed records.
- Synchronizes status changes from managed record pages and People pages back to source notes.
- Tracks configured folder renames and highlights missing configured folders.
- No longer writes unmanaged Risk sections to the bottom of People pages.

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
