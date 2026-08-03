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

### Changed

- The Tasks community plugin is no longer required. Personal `- [ ]` checkboxes are native Obsidian markdown and always worked without it; the due-date `[due:: ]` suggest now also triggers on `- [ ]` task lines (not just record lines), so due dates no longer need Tasks' own emoji shortcut. If you relied on Tasks' global query to list open tasks, replace it with an equivalent Dataview query, e.g. `TASK WHERE !completed` (Dataview is already a required plugin).
- Checking a `- [ ]` task checkbox now automatically appends `[completed:: YYYY-MM-DD]` to the end of the line; unchecking it removes the completed date again. Detected as a live editor extension, so it works the same way Tasks' own auto-done-date behavior did, without needing that plugin.
- Unresolved `[[Name]]` links on `- [ ]` personal task lines are now picked up during sync the same way unresolved links inside d::/r::/i::/e::/a:: records already were — with "Create unresolved links as people" enabled, a person page is created from the person template. The task line itself is still never synced or tracked as a record.
- Added a Tasks section to the Meeting Mode panel, below Open Items: lists open `- [ ]` personal tasks scoped the same way Open Items is (by the current/searched owner, or vault-wide when none is selected — matched by whether the task line contains a `[[Person]]` link to that owner). A checkbox per row toggles the task (reusing the existing checked/unchecked `[completed:: ]` logic); clicking the text navigates to and flashes the source line.
- Added a "Tasks: N" counter alongside the existing per-type record counters, showing the count of open `- [ ]` lines in the active note; clicking it highlights all of them in the editor, same as the record-type counters.
- Clicking an Open Items or Tasks row in the Meeting Mode panel now opens the source note in a new tab instead of replacing whatever was in the active pane — unless that note is already open in an existing tab, in which case it switches to that tab instead of opening a duplicate.

### Fixed

- Clicking an Open Item whose record note frontmatter is out of sync with the source line (e.g. you edited the line after the last sync) previously failed to scroll/highlight silently. It now falls back to a prefix match (handles text appended or trimmed since the last sync) and shows a Notice explaining what happened when it truly can't find a match, instead of failing with no feedback.

### Added

- Added a "Sync delay" setting exposing the previously hardcoded `debounceMs` (default 1800ms) — controls how long Automatic sync waits after you stop typing, and how long a Base status edit waits before syncing back to the source note. Presented as a dropdown with presets (1.8 seconds, 5 minutes, 15 minutes); a previously-set custom value still shows as an extra option. Requires reloading the plugin after changing it, since the debounced functions are created once at load time.

A flush-on-app-close feature (sync any pending edit immediately when Obsidian quits) was attempted and reverted — Electron doesn't give plugins a reliable window to finish async file writes between quit and process exit, so `onunload` couldn't be made to complete the flush in practice. If a delay-worth of edits sits unsynced, run "Sync entire vault" or "Sync current note" before closing Obsidian.

- Open Items and Tasks in the Meeting Mode panel are now sorted by due date (soonest first); items with no due date sort after those that have one, keeping their previous alphabetical order among themselves.

### Fixed

- The counter-click "highlight matching lines" feature was silently a no-op in some environments: it was built on a CodeMirror `StateField`, which wasn't consistently included in the active editor state, so the dispatched highlight effect had nowhere to land. Rewritten as a `ViewPlugin` (the same mechanism the working marker-color feature already used), which resolved it.

### Added

- Added a "Search by dept" input to Open Items, alongside the existing "Search by person" one — resolves to every Person note sharing that `dept` frontmatter value and scopes/groups Open Items and Tasks the same way person search does. Selecting a department clears an active person search and vice versa (mutually exclusive, since they're alternate ways to define the same "who" scope); the Clear button resets both.

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
