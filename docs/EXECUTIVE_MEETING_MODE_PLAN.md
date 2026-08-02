# ACE2X Executive Meeting Mode (v0.6) — Implementation Plan

Written for a Claude Code session with `npm run dev` and a real Obsidian vault available, so it can compile and reload the plugin as it goes. This doc captures decisions already made so they aren't re-litigated — read it before writing code.

## 1. Decisions already made (do not re-ask)

- **Capture syntax**: reuse the existing single-line convention. A captured item is one line: `type:: text [[Owner]] #tag`, with `s::o` / `s::d` for status. No new multi-line `owner::`/`status::`/`created::`/`source::` block. `date`, `source`, and `source_path` continue to be derived automatically by the sync engine — never written inline.
- **Interaction model (Model A)**: Quick Capture is a single smart text field. The user types the line themselves, prefix included (`e::`, `r::`, `i::`, `d::`, `a::`, or no prefix for a plain note). There is **no** category radio-button list and **no** single-letter hotkey scheme (`E`/`R`/`I`/`D`/`A`/`N` as bare keys was rejected — those letters appear in nearly every sentence, so they can't be bare shortcuts inside a text field). Enter parses the typed prefix, auto-appends the detected/selected owner's wikilink if the line doesn't already contain one, appends `s::o`, inserts the line, and triggers an immediate sync.
- **Personal tasks vs. tracked actions**: `- [ ]` (Tasks plugin) stays exactly as-is for the user's own action items — out of scope, do not touch. `a::` is a **new** record type, parallel to `d::`/`r::`/`i::`/`e::`, for action items delegated to other people that the user wants tracked in the Base/dashboard like everything else.
- **Scope**: build the full v0.6 spec in one pass — side panel, quick capture, live counters, meeting detection, smart owner default, Open Items list with search and click-to-complete, and auto-linking (owner/meeting/project/program/capability/tags).
- Two things in the original spec turned out to already be solved by the existing engine and need **no new code**:
  - "Automatic BASE refresh" — the master dashboard is a native Obsidian `.base` file (`ensureKnowledgeBase()` / `buildKnowledgeBaseContent()`), which is a live query over record note frontmatter. As soon as a record file exists with the right frontmatter, it shows up. There is nothing to "refresh."
  - "Click an Open Item to mark it done" — `syncRecordStatusToSource()` (main.ts:1226) already does exactly this: write `status: Done` + `completed_date` to a record file's frontmatter, then it rewrites the inline line in the source note (adds `s::d`, strikethrough) and re-syncs. Reuse it as-is.

## 2. Current architecture (verified by reading the code, not assumed)

Everything lives in one file, `src/main.ts` (~1425 lines, `@ts-nocheck`, no test suite). Key pieces Meeting Mode will hook into:

- `RECORD_TYPES` (line ~30): map of `d|r|i|e` → `{ key, singular, heading, typeName, folderSetting }`. This is the single source of truth for record types — most downstream code (`isManagedRecordFile`, `isManagedRecordPath`) already iterates `Object.values(RECORD_TYPES)` generically. A few places do **not** and hardcode the letters — see §3.
- `extractRecords(text, sourceFile)` (line ~802): the parser. Regex is `^\s*(?:[-*+]\s*)?(d|r|i|e)::\s*(.+?)\s*$` — one line only, type letter derived from the match, owner derived by scanning that same line's `[[wikilinks]]` for ones resolving to a Person file, status from a trailing `s::o`/`s::d`, tags from trailing `#tags`.
- `analyzeFile(file)` → `applyAnalysis(analysis)` → `syncRecordNotes(...)` + `ensureKnowledgeBase()`: the full pipeline that turns parsed records into record note files and creates the dashboard Base if missing. `syncFile(file, showNotice)` (line ~622) is the one-call entry point that runs this whole pipeline for a single file — **this is what Quick Capture should call after inserting a line**, no new sync logic needed.
- `buildRecordNote(record, sourceFile, sourceLink, date)` (line ~933): builds the frontmatter for a record note (`type`, `sentence`, `owner`, `source`, `source_path`, `date`, `status`, `completed_date`, `record_id`, `tags`).
- `syncRecordStatusToSource(recordFile)` (line ~1226): reverse-sync, record file → source note. Reads the record's frontmatter status, finds the matching line in the source file by type + canonicalized text, rewrites it with the new status, re-analyzes the source file. This is what Open Items' click-to-complete will call.
- `isPersonFile` / `resolvePersonLink` / `extractResolvedPeople` (lines ~731–757): the pattern for resolving a wikilink to a typed note. Auto-linking to Project/Program/Capability/Meeting should generalize this pattern, not duplicate it.
- Settings tab (`ACE2XKnowledgeOSSettingTab`, line ~1273): per-folder dropdowns built via `addFolderPicker`, plus a static syntax reference table (`renderTermsReference`, line ~1388) that already documents `- Action [[Name]]` as an informal convention for "another person's action" — this is being formalized into `a::` now.

## 3. Places that hardcode record-type letters (must update for `a::`)

These do **not** iterate `RECORD_TYPES` and will silently ignore Actions unless changed:

- `extractRecords` regex (line ~806): `(d|r|i|e)` → needs `a` added, or better, build the alternation dynamically from `Object.keys(RECORD_TYPES)` so a future 6th type doesn't require another manual regex fix.
- `syncRecordStatusToSource` line-matching regex (line ~1243): same `(d|r|i|e)` hardcode — same fix, same reasoning. If missed, clicking an Action open in Open Items will update the record file but never strike the line in the source note.
- `shouldProcess`'s `managedFolders` list (line ~517–520): only lists executive/decisions/risks/issues folders. Add `actionsFolder` or the new Actions record folder will get treated as a regular note folder and re-scanned for records, which is wrong.
- `syncKnowledgeOSStatusChanges`'s `managedFolders` list (line ~1177–1179): same issue — add the Actions folder or the manual "sync status changes" command won't catch Actions.
- `folderSettingKeys()` (line ~358–360) and the `folderLabels` map in `validateEnvironment` (line ~295–302): add `actionsFolder` so the environment validator checks it.
- `autoDetectFolders`'s `mappings` (line ~409–416): add an `actionsFolder: ["actions", "action items"]` entry.
- Settings tab folder pickers (line ~1327–1330): add one more `addFolderPicker(...)` call for Actions.
- `renderTermsReference` (line ~1398–1408): add an `a::` row, remove/update the now-superseded "informal Action" row.

`isManagedRecordFile` / `isManagedRecordPath` (line ~452–466) are already generic over `RECORD_TYPES` values — no change needed there once the new entry exists.

## 4. Data model additions

**`RECORD_TYPES`**: add
```js
a: { key: "actions", singular: "Action", heading: "Actions", typeName: "action", folderSetting: "actionsFolder" }
```

**`DEFAULT_SETTINGS`**: add
- `actionsFolder` — new folder setting, same pattern as the other four.
- `yourPersonNote` — path to the Person note representing the plugin's user, so Smart Owner Detection knows who to exclude from a meeting's participant list. Leave blank-safe: if unset, don't exclude anyone.
- `meetingModeAutoOpen` — open the panel automatically when a note with a `participants` frontmatter field becomes active.
- `meetingModeRememberOwner` / `meetingModeRememberCategory` — persist last-used owner/category across captures.
- `meetingModeShowCounters` — toggle live counters.
- `meetingModeFocusAfterSave` — refocus Quick Capture input after Enter (should default true; this is the whole point of "keep hands on keyboard").
- `priorityEnabled` (default false) and `priorityLevels` (default `["None", "Low", "Medium", "High"]`) — priority wasn't in the original spec's data model at all, only in the mockup. Flagging as new; confirm the level list is right before shipping, I picked a reasonable default.
- `autoLinkTypes` — map of frontmatter `type` values to treat as auto-link targets beyond Person, e.g. `{ project: "project", program: "program", capability: "capability", meeting: "meeting" }`. Generalizes the existing Person-only resolution in `resolvePersonLink`/`extractResolvedPeople`.

**`buildRecordNote`**: add `priority: <value>` to the frontmatter block (only if `priorityEnabled`), and add resolved `project`/`program`/`capability`/`meeting` fields alongside the existing `owner` field, populated the same way `owners` is today but using the generalized typed-link resolver from §5.

**`buildKnowledgeBaseContent`**: add `priority` as a displayable/sortable property and column to the existing views if `priorityEnabled`.

## 5. Auto-linking generalization

Today, `resolvePersonLink` only resolves links to Person files. Generalize it:

```
resolveTypedLink(link, sourceFile, typeName)  // same as resolvePersonLink but checks frontmatter.type === typeName instead of isPersonFile
extractResolvedByType(text, sourceFile, typeName)  // same pattern as extractResolvedPeople
```

Then for each record, in addition to `people` (existing), compute `project`/`program`/`capability`/`meeting` by resolving wikilinks in the record's text against `settings.autoLinkTypes`. Only link if the target already exists and has a matching `type:` in frontmatter — do not create these files automatically (unlike people, which have an opt-in auto-create setting). This matches the original spec's "if they already exist" wording exactly.

## 6. Meeting detection & Smart Owner Detection

- On the active file, read `frontmatter.participants` (array of wikilinks) via `app.metadataCache.getFileCache(file)?.frontmatter`.
- Resolve each participant the same way `resolvePersonLink` does.
- Exclude the person matching `settings.yourPersonNote` from the resolved list.
- If exactly one participant remains, that's the default owner (still overridable).
- If more than one, populate a small dropdown scoped to just those participants — not a full People search, per spec.
- If the active file has no `participants` field at all, fall back to the last-remembered owner (if `meetingModeRememberOwner`) or leave owner unset and require the user to pick one.
- Meeting title/date for the panel header: file basename + `frontmatter.date` (reuse `getSourceDate`, already exists).

## 7. Side panel (net-new subsystem — nothing like this exists in the plugin today)

Obsidian side panels are `ItemView` subclasses registered with `registerView` and opened via `workspace.getRightLeaf(false)`. The plugin currently only has `Modal` subclasses, so this is genuinely new, not an extension of existing UI code.

- New view type constant, e.g. `VIEW_TYPE_MEETING_MODE = "ace2x-meeting-mode"`.
- `registerView` in `onload()`, plus commands: `Start Executive Meeting Mode`, `Stop Executive Meeting Mode`, `Toggle Meeting Panel`, and direct-capture commands (`Capture Executive Follow-up`, `Capture Risk`, `Capture Issue`, `Capture Decision`, `Capture Action`) that open/focus the panel and prefill the type prefix.
- Ribbon icon (🎯 or a lucide `target` icon) toggles the panel.
- Panel sections, top to bottom: meeting title/date header, owner (auto-detected, overridable), Quick Capture input, live counters, Open Items (search + list).

**File organization**: don't add ~600+ more lines to `src/main.ts`. Split into new files under `src/meetingMode/`:
- `src/meetingMode/view.ts` — the `ItemView` subclass and DOM rendering.
- `src/meetingMode/capture.ts` — prefix parsing, line building, insert-and-sync glue.
- `src/meetingMode/linking.ts` — the generalized typed-link resolver from §5.

`main.ts` wires `registerView`/commands/ribbon and delegates into these. esbuild bundles from the single entry point already, so this is a normal module split with no build config changes. Recommend giving these new files real types (at least basic interfaces for Settings, Record, Person) even though `main.ts` keeps `@ts-nocheck` — no reason to add more untyped surface than already exists.

## 8. Quick Capture pipeline (the core feature)

On Enter in the Quick Capture field:

1. Match input against `/^(d|r|i|e|a)::\s*(.+)$/i` (built dynamically from `RECORD_TYPES` keys, see §3).
2. No match → treat as a plain Note: insert `- {text}` with no metadata, no sync call needed.
3. Match → `type` + `body`. If `body` contains no wikilink resolving to a Person, append `" [[${currentOwner.canonicalLink}]]"`. Append `" s::o"`.
4. Insert the finished line into the active meeting note. **Open decision, not yet resolved**: append to end of file (simplest, no editor-focus edge cases while the side panel has input focus) vs. insert at a remembered cursor position in the note (matches "never leave the meeting note" more literally but requires tracking the last-active `MarkdownView`'s cursor before focus moved to the panel). Recommend shipping append-to-end-of-file first since it's simpler and the spec's own mockup doesn't actually specify exact placement, then upgrade to cursor-tracking if it feels wrong in real use.
5. Call `this.syncFile(sourceFile, false)` — reuses the entire existing pipeline unchanged. This is what makes the record file appear and the Base update.
6. Update live counters by reading `this.index[sourceFile.path]?.records`, grouped by type (already populated by step 5, no extra query needed).
7. If `meetingModeFocusAfterSave`, refocus the input and clear it.
8. If `meetingModeRememberOwner`/`meetingModeRememberCategory`, keep the last owner/prefix as the pre-filled default for the next capture.

## 9. Open Items panel

- Query: `app.vault.getMarkdownFiles()` filtered to paths under any `RECORD_TYPES` folder setting, frontmatter `status !== "Done"`, optionally scoped to the current owner.
- Render `sentence` (frontmatter) as the row label. Search box filters this list by substring against `sentence`.
- **Spec inconsistency to resolve during build, not before**: the original spec uses the same "click" gesture to mean two different things — clicking an Open Item marks it done, but clicking a search result is supposed to "jump to the original location." Recommend: a small checkbox/button per row for complete (calls `processFrontMatter` to set `status: Done` + `completed_date`, then `syncRecordStatusToSource(file)`), and clicking the row text itself always navigates to the source note (`workspace.getLeaf().openFile(...)` on `frontmatter.source_path`). Keeps one consistent behavior per gesture instead of two conflicting ones depending on which list you're in.

## 10. Settings tab additions

Add, following the existing `addFolderPicker`/`Setting` patterns already in `ACE2XKnowledgeOSSettingTab.display()`:
- Actions folder picker (§3).
- Your person note picker (dropdown of People-folder files, for Smart Owner Detection's self-exclusion).
- Toggles: open automatically for meeting notes, remember previous owner, remember previous category, show live counters, focus cursor after save.
- Priority enabled toggle + editable level list (if keeping the priority feature).
- Update `renderTermsReference` with the new `a::` row.

## 11. Build order

Recommended sequence — each phase should compile and pass a manual smoke test before the next starts:

1. **Data model**: `RECORD_TYPES` + `DEFAULT_SETTINGS` additions for Actions, fix every hardcoded-letter spot in §3, update settings tab folder picker + syntax table. Regression-check: existing `d::`/`r::`/`i::`/`e::` sync still works unchanged (run `Sync entire vault` against a test note).
2. **Auto-linking + priority**: generalize the typed-link resolver (§5), wire `project`/`program`/`capability`/`meeting`/`priority` into `buildRecordNote` and the Base view definitions.
3. **Panel scaffold**: `ItemView` registration, ribbon icon, open/close/toggle commands, static layout, no data wiring yet.
4. **Meeting detection + Smart Owner Detection**: wire the panel header to real frontmatter.
5. **Quick Capture pipeline**: the parse → insert → `syncFile` loop, live counters.
6. **Open Items panel**: query, render, search, complete/navigate actions.
7. **Settings tab**: all new Meeting Mode options.
8. **Manual test pass** (no automated tests exist in this repo): single-participant meeting → auto owner; multi-participant → dropdown; `d::`/`r::`/`i::`/`e::`/`a::` capture each produce correct record files; plain-text capture produces a bare bullet; click-to-complete strikes the source line and the item disappears from the Base's open views without any manual refresh; existing `Sync entire vault`/`Sync current note`/`Validate ACE2X environment` commands still behave identically to before this change. Bump `manifest.json`/`package.json` to `0.6.0` and add a `CHANGELOG.md` entry once verified.

## 12. Known gaps carried over from the original spec (decide when you get there, not now)

- Exact line-insertion placement in the note (§8, step 4).
- Whether `priorityLevels` default list is right (§4).
- Whether Open Items should be scoped to the current meeting's owner only, or show all open items across the vault with owner as a filter — the spec's mockup shows it scoped to one owner ("Jonathan Landon" header), but doesn't say what happens with no owner selected yet.
