import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from "obsidian";
import { EditorView } from "@codemirror/view";
import { parseCaptureInput, buildCaptureLine, appendLineToFile, CaptureOwner } from "./capture";
import { setHighlightLines } from "./highlightExtension";

export const VIEW_TYPE_MEETING_MODE = "ace2x-meeting-mode";

export interface PersonEntry {
  path: string;
  basename: string;
  display: string;
  canonicalLink: string;
}

export interface MeetingModePlugin {
  app: ItemView["app"];
  settings: Record<string, any>;
  index: Record<string, any>;
  getSourceDate(file: TFile): string;
  syncFile(file: TFile, showNotice?: boolean): Promise<void>;
  persist(): Promise<void>;
  resolvePersonLink(link: { target: string; alias: string | null }, sourceFile: TFile): PersonEntry | null;
  parseWikiLinks(text: string): { target: string; alias: string | null; raw: string }[];
  recordTypeKeys(): string[];
  recordTypeLabels(): Record<string, string>;
  recordFolderPaths(): string[];
  completeRecord(file: TFile): Promise<void>;
  recordTypeKeyForTypeName(typeName: string): string | null;
  findSourceLineNumber(content: string, typeKey: string | null, sentence: string): number;
  findAllSourceLineNumbers(content: string, typeKey: string | null): number[];
}

interface OpenItemRow {
  file: TFile;
  sentence: string;
  sourcePath: string;
  type: string;
}

function parseWikilinkString(raw: string): { target: string; alias: string | null } | null {
  const match = String(raw || "").trim().match(/^\[\[([^\]]+)\]\]$/);
  if (!match) return null;
  const [targetPart, alias] = match[1].split("|");
  const target = targetPart.split("#")[0].trim();
  if (!target) return null;
  return { target, alias: alias?.trim() || null };
}

export class MeetingModeView extends ItemView {
  plugin: MeetingModePlugin;
  headerTitleEl!: HTMLElement;
  headerDateEl!: HTMLElement;
  ownerSectionEl!: HTMLElement;
  captureInputEl!: HTMLInputElement;
  countersEl!: HTMLElement;
  openItemsSearchEl!: HTMLInputElement;
  openItemsEl!: HTMLElement;
  activeSourceFile: TFile | null = null;
  currentOwner: PersonEntry | null = null;
  highlightClearTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: MeetingModePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_MEETING_MODE;
  }

  getDisplayText(): string {
    return "Meeting Mode";
  }

  getIcon(): string {
    return "target";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("aceto-meeting-mode");

    const header = container.createDiv({ cls: "aceto-mm-header" });
    this.headerTitleEl = header.createEl("div", { cls: "aceto-mm-title", text: "No active meeting note" });
    this.headerDateEl = header.createEl("div", { cls: "aceto-mm-date" });

    this.ownerSectionEl = container.createDiv({ cls: "aceto-mm-owner" });
    this.ownerSectionEl.createEl("div", { cls: "aceto-mm-section-label", text: "Owner" });
    this.ownerSectionEl.createEl("div", { cls: "aceto-mm-owner-value", text: "—" });

    const captureSection = container.createDiv({ cls: "aceto-mm-capture" });
    captureSection.createEl("div", { cls: "aceto-mm-section-label", text: "Quick Capture" });
    this.captureInputEl = captureSection.createEl("input", {
      cls: "aceto-mm-capture-input",
      attr: { type: "text", placeholder: "d:: r:: i:: e:: a:: or plain text, then Enter" }
    });
    this.captureInputEl.addEventListener("keydown", (evt) => {
      if (evt.key !== "Enter") return;
      evt.preventDefault();
      void this.handleCaptureSubmit();
    });

    this.countersEl = container.createDiv({ cls: "aceto-mm-counters" });

    const openItemsSection = container.createDiv({ cls: "aceto-mm-open-items" });
    openItemsSection.createEl("div", { cls: "aceto-mm-section-label", text: "Open Items" });
    this.openItemsSearchEl = openItemsSection.createEl("input", {
      cls: "aceto-mm-open-items-search",
      attr: { type: "text", placeholder: "Search open items..." }
    });
    this.openItemsSearchEl.addEventListener("input", () => this.renderOpenItems());
    this.openItemsEl = openItemsSection.createDiv({ cls: "aceto-mm-open-items-list" });

    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshHeader()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refreshHeader()));
    this.registerEvent(this.app.metadataCache.on("changed", (file: TFile) => {
      if (this.activeSourceFile && file.path === this.activeSourceFile.path) this.refreshHeader();
    }));
    this.refreshHeader();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  setPrefill(prefix: string | null): void {
    if (!this.captureInputEl) return;
    this.captureInputEl.value = prefix ? `${prefix}:: ` : "";
    this.captureInputEl.focus();
    if (prefix) this.captureInputEl.setSelectionRange(this.captureInputEl.value.length, this.captureInputEl.value.length);
  }

  resolveActiveSourceFile(): TFile | null {
    const active = this.app.workspace.getActiveFile();
    return active instanceof TFile && active.extension === "md" ? active : null;
  }

  refreshHeader(): void {
    const file = this.resolveActiveSourceFile();
    this.activeSourceFile = file;
    if (!file) {
      this.headerTitleEl.setText("No active meeting note");
      this.headerDateEl.setText("");
    } else {
      this.headerTitleEl.setText(file.basename);
      this.headerDateEl.setText(this.plugin.getSourceDate(file));
    }
    this.refreshOwner();
    this.refreshCounters();
  }

  refreshCounters(): void {
    this.countersEl.empty();
    if (!this.plugin.settings.meetingModeShowCounters) return;
    const file = this.activeSourceFile;
    const records: { type: string }[] = (file && this.plugin.index[file.path]?.records) || [];
    const labels = this.plugin.recordTypeLabels();
    const counts: Record<string, number> = {};
    for (const record of records) counts[record.type] = (counts[record.type] || 0) + 1;
    for (const type of this.plugin.recordTypeKeys()) {
      const count = counts[type] || 0;
      const counterEl = this.countersEl.createEl("span", { cls: "aceto-mm-counter", text: `${labels[type] || type}: ${count}` });
      if (count > 0) {
        counterEl.addClass("is-clickable");
        counterEl.addEventListener("click", () => this.highlightRecordsOfType(type));
      }
    }
  }

  findActiveMarkdownLeaf(file: TFile): WorkspaceLeaf | null {
    return this.app.workspace.getLeavesOfType("markdown").find((leaf) => (leaf.view as any)?.file?.path === file.path) || null;
  }

  highlightRecordsOfType(typeKey: string): void {
    const file = this.activeSourceFile;
    if (!file) return;
    const leaf = this.findActiveMarkdownLeaf(file);
    const markdownView = leaf?.view instanceof MarkdownView ? leaf.view : null;
    const cm: EditorView | undefined = (markdownView?.editor as any)?.cm;
    if (!leaf || !markdownView || !cm) return;

    this.app.workspace.revealLeaf(leaf);
    const content = markdownView.editor.getValue();
    const lineNumbers = this.plugin.findAllSourceLineNumbers(content, typeKey).map((i) => i + 1);
    cm.dispatch({ effects: setHighlightLines.of(lineNumbers) });

    if (this.highlightClearTimer !== null) window.clearTimeout(this.highlightClearTimer);
    this.highlightClearTimer = window.setTimeout(() => {
      cm.dispatch({ effects: setHighlightLines.of([]) });
      this.highlightClearTimer = null;
    }, 4000);
  }

  async handleCaptureSubmit(): Promise<void> {
    const raw = this.captureInputEl.value;
    if (!raw.trim()) return;
    const file = this.activeSourceFile;
    if (!file) return;

    const parsed = parseCaptureInput(raw, this.plugin.recordTypeKeys());
    const bodyHasPersonLink = Boolean(
      parsed.type && this.plugin.parseWikiLinks(parsed.body).some((link) => this.plugin.resolvePersonLink(link, file))
    );
    const owner: CaptureOwner | null = this.currentOwner
      ? { basename: this.currentOwner.basename, canonicalLink: this.currentOwner.canonicalLink }
      : null;
    const line = buildCaptureLine(parsed, owner, bodyHasPersonLink);

    await appendLineToFile(this.app, file, line);
    if (parsed.type) await this.plugin.syncFile(file, false);
    this.refreshCounters();
    this.renderOpenItems();

    let nextPrefix: string | null = null;
    if (this.plugin.settings.meetingModeRememberCategory && parsed.type) {
      nextPrefix = parsed.type;
      this.plugin.settings.lastCapturePrefix = parsed.type;
      void this.plugin.persist();
    }

    if (this.plugin.settings.meetingModeFocusAfterSave) {
      this.setPrefill(nextPrefix);
    } else {
      this.captureInputEl.value = nextPrefix ? `${nextPrefix}:: ` : "";
    }
  }

  frontmatterLinksToPeople(file: TFile, fieldValue: any): PersonEntry[] {
    const list: string[] = Array.isArray(fieldValue) ? fieldValue : fieldValue ? [fieldValue] : [];
    const resolved: PersonEntry[] = [];
    for (const entry of list) {
      const link = parseWikilinkString(entry);
      if (!link) continue;
      const person = this.plugin.resolvePersonLink(link, file);
      if (person) resolved.push(person);
    }
    return resolved;
  }

  resolveParticipants(file: TFile): PersonEntry[] {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const resolved: PersonEntry[] = [];
    const seen = new Set<string>();
    for (const field of ["participants", "people", "owner"]) {
      for (const person of this.frontmatterLinksToPeople(file, fm?.[field])) {
        if (!seen.has(person.path)) {
          seen.add(person.path);
          resolved.push(person);
        }
      }
    }
    const yourPath = String(this.plugin.settings.yourPersonNote || "");
    return yourPath ? resolved.filter((p) => p.path !== yourPath) : resolved;
  }

  resolveExplicitOwner(file: TFile): PersonEntry | null {
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return this.frontmatterLinksToPeople(file, fm?.owner)[0] || null;
  }

  refreshOwner(): void {
    this.ownerSectionEl.empty();
    this.ownerSectionEl.createEl("div", { cls: "aceto-mm-section-label", text: "Owner" });

    const file = this.activeSourceFile;
    const candidates = file ? this.resolveParticipants(file) : [];

    if (!candidates.length) {
      this.currentOwner = null;
      this.ownerSectionEl.createEl("div", {
        cls: "aceto-mm-owner-value",
        text: "No owner detected — include [[Person]] in the capture line"
      });
      this.renderOpenItems();
      return;
    }

    const select = this.ownerSectionEl.createEl("select", { cls: "aceto-mm-owner-select" });
    for (const person of candidates) {
      select.createEl("option", { value: person.path, text: person.basename });
    }

    let defaultPath = candidates[0].path;
    const explicitOwner = file ? this.resolveExplicitOwner(file) : null;
    if (
      this.plugin.settings.meetingModeRememberOwner &&
      this.plugin.settings.lastOwnerPath &&
      candidates.some((c) => c.path === this.plugin.settings.lastOwnerPath)
    ) {
      defaultPath = this.plugin.settings.lastOwnerPath;
    }
    if (explicitOwner && candidates.some((c) => c.path === explicitOwner.path)) {
      defaultPath = explicitOwner.path;
    }
    select.value = defaultPath;
    this.currentOwner = candidates.find((c) => c.path === defaultPath) || candidates[0];

    select.addEventListener("change", () => {
      this.currentOwner = candidates.find((c) => c.path === select.value) || null;
      if (this.plugin.settings.meetingModeRememberOwner && this.currentOwner) {
        this.plugin.settings.lastOwnerPath = this.currentOwner.path;
        void this.plugin.persist();
      }
      this.renderOpenItems();
    });

    this.renderOpenItems();
  }

  queryOpenItems(): OpenItemRow[] {
    const folders = this.plugin.recordFolderPaths();
    const rows: OpenItemRow[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!folders.some((folder) => file.path === folder || file.path.startsWith(folder + "/"))) continue;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!fm || !fm.record_id || !fm.source_path) continue;
      if (String(fm.status || "").toLowerCase() === "done") continue;
      if (this.currentOwner) {
        const ownerPaths = this.frontmatterLinksToPeople(file, fm.owner).map((p) => p.path);
        if (!ownerPaths.includes(this.currentOwner.path)) continue;
      }
      rows.push({
        file,
        sentence: String(fm.sentence || file.basename),
        sourcePath: String(fm.source_path || ""),
        type: String(fm.type || "")
      });
    }
    rows.sort((a, b) => a.sentence.localeCompare(b.sentence));
    return rows;
  }

  renderOpenItems(): void {
    if (!this.openItemsEl) return;
    this.openItemsEl.empty();
    const query = this.openItemsSearchEl.value.trim().toLowerCase();
    const rows = this.queryOpenItems().filter((row) => !query || row.sentence.toLowerCase().includes(query));

    if (!rows.length) {
      this.openItemsEl.createEl("div", { cls: "aceto-mm-open-items-empty", text: "No open items." });
      return;
    }

    for (const row of rows) {
      const rowEl = this.openItemsEl.createDiv({ cls: "aceto-mm-open-item" });
      const checkbox = rowEl.createEl("input", { attr: { type: "checkbox" } });
      checkbox.addEventListener("change", () => void this.completeOpenItem(row));
      const text = rowEl.createEl("span", { cls: "aceto-mm-open-item-text", text: row.sentence });
      text.addEventListener("click", () => void this.openSourceForItem(row));
    }
  }

  async completeOpenItem(row: OpenItemRow): Promise<void> {
    await this.plugin.completeRecord(row.file);
    this.renderOpenItems();
    this.refreshCounters();
  }

  async openSourceForItem(row: OpenItemRow): Promise<void> {
    const sourceFile = this.app.vault.getAbstractFileByPath(row.sourcePath);
    if (!(sourceFile instanceof TFile)) return;
    const typeKey = this.plugin.recordTypeKeyForTypeName(row.type);
    const content = await this.app.vault.cachedRead(sourceFile);
    const line = this.plugin.findSourceLineNumber(content, typeKey, row.sentence);
    const leaf = this.app.workspace.getLeaf();
    if (line >= 0) {
      await leaf.openFile(sourceFile, { eState: { line, focus: true } } as any);
    } else {
      await leaf.openFile(sourceFile);
    }
  }
}
