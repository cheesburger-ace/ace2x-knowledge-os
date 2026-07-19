// @ts-nocheck
import {
  Plugin,
  PluginSettingTab,
  Setting,
  Notice,
  TFile,
  TFolder,
  Modal,
  normalizePath,
  debounce
} from "obsidian";

const DEFAULT_SETTINGS = {
  peopleFolder: "98.Knowledge/People",
  personTemplatePath: "99.System/Templates/Template, Person.md",
  executiveFolder: "12. 🎯 Executive",
  decisionsFolder: "16. ⚖️ Decisions",
  risksFolder: "17. ⚠️ Risks",
  issuesFolder: "18. 🚧 Issues",
  dashboardFolder: "01.Home/Dashboards",
  dashboardBaseName: "00.🎛️ Master",
  autoSync: false,
  autoCreatePeople: false,
  debounceMs: 1800,
  excludedFolders: ["99.System/Templates"],
  excludedHeadings: ["links", "backlinks", "references", "related", "carry forward", "same day"]
};

const RECORD_TYPES = {
  d: { key: "decisions", singular: "Decision", heading: "Decisions", typeName: "decision", folderSetting: "decisionsFolder" },
  r: { key: "risks", singular: "Risk", heading: "Risks", typeName: "risk", folderSetting: "risksFolder" },
  i: { key: "issues", singular: "Issue", heading: "Issues", typeName: "issue", folderSetting: "issuesFolder" },
  e: { key: "executive_follow_ups", singular: "Executive Follow-up", heading: "Executive Follow-ups", typeName: "executive-follow-up", folderSetting: "executiveFolder" }
};

class MetadataPreviewModal extends Modal {
  constructor(app, analysis, onApply) {
    super(app);
    this.analysis = analysis;
    this.onApply = onApply;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("aceto-metadata-preview");
    contentEl.createEl("h2", { text: "Metadata Preview" });
    contentEl.createEl("div", { cls: "aceto-preview-file", text: this.analysis.file.path });

    this.renderSection(contentEl, "People", this.analysis.people.map((x) => x.display));
    this.renderSection(contentEl, "Tags", this.analysis.tags.map((x) => `#${x}`));
    this.renderSection(contentEl, "Decisions", this.analysis.records.filter((x) => x.type === "d").map((x) => x.displayText));
    this.renderSection(contentEl, "Risks", this.analysis.records.filter((x) => x.type === "r").map((x) => x.displayText));
    this.renderSection(contentEl, "Issues", this.analysis.records.filter((x) => x.type === "i").map((x) => x.displayText));
    this.renderSection(contentEl, "Executive Follow-ups", this.analysis.records.filter((x) => x.type === "e").map((x) => x.displayText));

    const changes = [
      `Source metadata: ${this.analysis.sourceWillChange ? "will update" : "no indexed change"}`,
      `Person pages affected: ${this.analysis.affectedPersonPaths.length}`,
      `Unresolved links: ${this.analysis.unresolvedLinks.length}`
    ];
    this.renderSection(contentEl, "Changes", changes);

    if (this.analysis.unresolvedLinks.length) {
      const warning = contentEl.createDiv({ cls: "aceto-preview-warning" });
      warning.createEl("strong", { text: "Unresolved links" });
      warning.createEl("div", { text: this.analysis.unresolvedLinks.map((x) => `[[${x}]]`).join(", ") });
      warning.createEl("div", {
        text: this.analysis.autoCreatePeople
          ? "These pages will be created as person pages when applied."
          : "They will remain unresolved. Enable creation in settings only when these links represent people."
      });
    }

    const buttons = contentEl.createDiv({ cls: "aceto-preview-actions" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.close();
    const apply = buttons.createEl("button", { cls: "mod-cta", text: "Apply" });
    apply.onclick = async () => {
      apply.disabled = true;
      try {
        await this.onApply();
        this.close();
      } catch (error) {
        console.error(error);
        new Notice(`Metadata sync failed: ${error.message || error}`);
        apply.disabled = false;
      }
    };
  }

  renderSection(parent, title, items) {
    const section = parent.createDiv({ cls: "aceto-preview-section" });
    section.createEl("h3", { text: title });
    if (!items.length) {
      section.createEl("div", { cls: "aceto-preview-empty", text: "None" });
      return;
    }
    const list = section.createEl("ul");
    for (const item of items) list.createEl("li", { text: item });
  }

  onClose() { this.contentEl.empty(); }
}

class BatchPreviewModal extends Modal {
  constructor(app, title, analyses, onApply) {
    super(app);
    this.title = title;
    this.analyses = analyses;
    this.onApply = onApply;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("aceto-metadata-preview");
    contentEl.createEl("h2", { text: this.title });
    const totals = this.analyses.reduce((a, x) => {
      a.tags += x.tags.length;
      a.people += x.people.length;
      a.decisions += x.records.filter((r) => r.type === "d").length;
      a.risks += x.records.filter((r) => r.type === "r").length;
      a.issues += x.records.filter((r) => r.type === "i").length;
      a.executive += x.records.filter((r) => r.type === "e").length;
      a.unresolved += x.unresolvedLinks.length;
      return a;
    }, { tags: 0, people: 0, decisions: 0, risks: 0, issues: 0, executive: 0, unresolved: 0 });

    const list = contentEl.createEl("ul");
    list.createEl("li", { text: `Notes: ${this.analyses.length}` });
    list.createEl("li", { text: `People references: ${totals.people}` });
    list.createEl("li", { text: `Decisions: ${totals.decisions}` });
    list.createEl("li", { text: `Risks: ${totals.risks}` });
    list.createEl("li", { text: `Issues: ${totals.issues}` });
    list.createEl("li", { text: `Executive follow-ups: ${totals.executive}` });
    list.createEl("li", { text: `Tags: ${totals.tags}` });
    if (totals.unresolved) list.createEl("li", { text: `Unresolved links: ${totals.unresolved}` });

    const buttons = contentEl.createDiv({ cls: "aceto-preview-actions" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.close();
    const apply = buttons.createEl("button", { cls: "mod-cta", text: "Apply" });
    apply.onclick = async () => {
      apply.disabled = true;
      try {
        await this.onApply();
        this.close();
      } catch (error) {
        console.error(error);
        new Notice(`Metadata sync failed: ${error.message || error}`);
        apply.disabled = false;
      }
    };
  }

  onClose() { this.contentEl.empty(); }
}

export default class ACE2XKnowledgeOSPlugin extends Plugin {
  async onload() {
    let saved = await this.loadData() || {};
    if (!Object.keys(saved).length) saved = await this.loadLegacyPluginData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings || saved);
    this.index = saved.index || {};
    this.processingPaths = new Set();
    this.lastTransaction = null;

    this.syncDebounced = debounce(async (file) => {
      if (file instanceof TFile) await this.syncFile(file, false);
    }, this.settings.debounceMs, true);

    this.personStatusDebounced = debounce(async (file) => {
      if (file instanceof TFile) await this.syncPersonStatusesToSources(file);
    }, this.settings.debounceMs, true);

    this.recordStatusDebounced = debounce(async (file) => {
      if (file instanceof TFile) await this.syncRecordStatusToSource(file);
    }, this.settings.debounceMs, true);

    this.addRibbonIcon("refresh-cw", "Preview knowledge sync", () => this.previewCurrentNote());
    this.addCommand({ id: "analyze-current-note", name: "Analyze current note", callback: () => this.previewCurrentNote() });
    this.addCommand({ id: "sync-current-note", name: "Sync current note", callback: () => this.previewCurrentNote() });
    this.addCommand({ id: "sync-current-folder", name: "Sync current folder", callback: () => this.previewCurrentFolder() });
    this.addCommand({ id: "sync-entire-vault", name: "Sync entire vault", callback: () => this.previewEntireVault() });
    this.addCommand({ id: "sync-knowledge-os-status-changes", name: "Sync Knowledge OS Status Changes", callback: async () => {
      await this.syncKnowledgeOSStatusChanges();
    }});
    this.addCommand({ id: "auto-detect-folders", name: "Auto-detect configured folders", callback: async () => {
      const changed = await this.autoDetectFolders();
      new Notice(changed ? "Knowledge OS folder locations updated." : "No better folder matches were found.");
    }});
    this.addCommand({ id: "undo-last-sync", name: "Undo last sync", checkCallback: (checking) => {
      if (!this.lastTransaction) return false;
      if (!checking) this.undoLastTransaction();
      return true;
    }});

    this.registerEvent(this.app.vault.on("rename", async (file, oldPath) => {
      if (!(file instanceof TFolder)) return;
      const changed = this.updateConfiguredPathsAfterFolderRename(oldPath, file.path);
      if (changed) {
        await this.persist();
        new Notice("Knowledge OS folder settings updated after folder rename.");
      }
    }));

    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (!(file instanceof TFile)) return;
      if (this.processingPaths.has(file.path)) return;
      if (this.isPersonFile(file)) {
        this.personStatusDebounced(file);
        return;
      }
      if (this.isManagedRecordFile(file) || this.isManagedRecordPath(file)) {
        this.recordStatusDebounced(file);
        return;
      }
      if (this.settings.autoSync && this.shouldProcess(file)) this.syncDebounced(file);
    }));

    this.addSettingTab(new ACE2XKnowledgeOSSettingTab(this.app, this));
  }

  onunload() {
    if (this.syncDebounced?.cancel) this.syncDebounced.cancel();
    if (this.personStatusDebounced?.cancel) this.personStatusDebounced.cancel();
    if (this.recordStatusDebounced?.cancel) this.recordStatusDebounced.cancel();
  }
  folderSettingKeys() {
    return ["peopleFolder", "executiveFolder", "decisionsFolder", "risksFolder", "issuesFolder", "dashboardFolder"];
  }

  vaultFolderPaths() {
    return this.app.vault.getAllLoadedFiles()
      .filter((entry) => entry instanceof TFolder)
      .map((folder) => normalizePath(folder.path))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  }

  updateConfiguredPathsAfterFolderRename(oldPath, newPath) {
    oldPath = normalizePath(oldPath || "");
    newPath = normalizePath(newPath || "");
    let changed = false;
    for (const key of this.folderSettingKeys()) {
      const current = normalizePath(this.settings[key] || "");
      if (current === oldPath || current.startsWith(oldPath + "/")) {
        this.settings[key] = normalizePath(newPath + current.slice(oldPath.length));
        changed = true;
      }
    }
    return changed;
  }

  normalizedFolderLabel(path) {
    const name = String(path || "").split("/").pop() || "";
    return name.toLowerCase()
      .replace(/^\d+[. _-]*/, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  findFolderMatch(terms) {
    const folders = this.vaultFolderPaths();
    const scored = folders.map((path) => {
      const label = this.normalizedFolderLabel(path);
      let score = 0;
      for (const term of terms) {
        if (label === term) score = Math.max(score, 100);
        else if (label.includes(term)) score = Math.max(score, 60);
      }
      if (/archive|template|attachment/i.test(path)) score -= 50;
      return { path, score, depth: path.split("/").length };
    }).filter((item) => item.score > 0);
    scored.sort((a, b) => b.score - a.score || a.depth - b.depth || a.path.localeCompare(b.path));
    return scored[0]?.path || "";
  }

  async autoDetectFolders() {
    const mappings = {
      peopleFolder: ["people", "persons", "contacts"],
      executiveFolder: ["executive", "executive follow ups", "leadership"],
      decisionsFolder: ["decisions", "decision"],
      risksFolder: ["risks", "risk register", "risk"],
      issuesFolder: ["issues", "issue register", "issue"],
      dashboardFolder: ["dashboards", "dashboard", "home"]
    };
    let changed = false;
    for (const [key, terms] of Object.entries(mappings)) {
      const current = normalizePath(this.settings[key] || "");
      const currentExists = current && this.app.vault.getAbstractFileByPath(current) instanceof TFolder;
      if (currentExists) continue;
      const match = this.findFolderMatch(terms);
      if (match && match !== current) {
        this.settings[key] = match;
        changed = true;
      }
    }
    if (changed) await this.persist();
    return changed;
  }

  async loadLegacyPluginData() {
    const configDir = this.app.vault.configDir || ".obsidian";
    const candidates = [
      `${configDir}/plugins/aceto-knowledge-os/data.json`,
      `${configDir}/plugins/aceto-metadata-sync/data.json`
    ];
    for (const path of candidates) {
      try {
        if (!(await this.app.vault.adapter.exists(path))) continue;
        const parsed = JSON.parse(await this.app.vault.adapter.read(path));
        if (parsed && typeof parsed === "object") return parsed;
      } catch (error) {
        console.warn("ACE2X Knowledge OS could not migrate legacy settings", path, error);
      }
    }
    return {};
  }

  async persist() { await this.saveData({ settings: this.settings, index: this.index }); }

  isManagedRecordFile(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!fm?.record_id || !fm?.source_path) return false;
    return Object.values(RECORD_TYPES).some((definition) => fm.type === definition.typeName);
  }

  isManagedRecordPath(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    const path = normalizePath(file.path);
    return Object.values(RECORD_TYPES).some((definition) => {
      const folder = normalizePath(this.settings[definition.folderSetting] || "");
      return folder && path.startsWith(folder + "/");
    });
  }

  normalizedStatus(value) {
    const raw = String(value || "open").trim().toLowerCase();
    if (["d", "c", "done", "closed", "complete", "completed", "resolved"].includes(raw)) return "Done";
    return "Open";
  }

  statusIsClosed(value) {
    return this.normalizedStatus(value) === "Done";
  }

  parseInlineStatus(text) {
    const raw = String(text || "").trim();
    const unstruck = raw.replace(/^~~|~~$/g, "").trim();
    const doneMatch = unstruck.match(/(?:^|\s)done::\s*(\d{4}-\d{2}-\d{2})(?=\s|$)/i);
    const statusMatch = unstruck.match(/(?:^|\s)s::\s*(.*?)(?=\s+done::|$)/i);
    let body = unstruck;
    if (statusMatch) body = body.slice(0, statusMatch.index).trim();
    else if (doneMatch) body = `${body.slice(0, doneMatch.index)} ${body.slice(doneMatch.index + doneMatch[0].length)}`.trim();
    const struck = /^~~[\s\S]*~~$/.test(raw);
    return {
      text: body,
      status: this.normalizedStatus(statusMatch ? (statusMatch[1].trim() || "open") : (struck ? "done" : "open")),
      explicit: Boolean(statusMatch),
      doneDate: doneMatch ? doneMatch[1] : ""
    };
  }

  todayDate() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  withInlineStatus(text, status, requestedDoneDate = "") {
    const parsed = this.parseInlineStatus(text);
    const body = parsed.text.trim().replace(/^~~|~~$/g, "");
    const normalized = this.statusIsClosed(status) ? "Done" : "Open";
    if (normalized === "Done") {
      const doneDate = requestedDoneDate || parsed.doneDate || this.todayDate();
      return `~~${body} s::d done::${doneDate}~~`;
    }
    return `${body} s::o`;
  }

  shouldProcess(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return false;
    const path = normalizePath(file.path);
    const peopleFolder = normalizePath(this.settings.peopleFolder);
    if (path === peopleFolder || path.startsWith(peopleFolder + "/")) return false;
    const managedFolders = [this.settings.executiveFolder, this.settings.decisionsFolder, this.settings.risksFolder, this.settings.issuesFolder]
      .map((folder) => normalizePath(folder || ""))
      .filter(Boolean);
    if (managedFolders.some((folder) => path === folder || path.startsWith(folder + "/"))) return false;
    return !(this.settings.excludedFolders || []).some((folder) => {
      const normalized = normalizePath(folder.trim());
      return normalized && (path === normalized || path.startsWith(normalized + "/"));
    });
  }

  async previewCurrentNote() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return new Notice("No active note.");
    if (!this.shouldProcess(file)) return new Notice("This note is excluded from knowledge sync.");
    const analysis = await this.analyzeFile(file);
    new MetadataPreviewModal(this.app, analysis, async () => {
      this.beginTransaction(`Sync ${file.basename}`);
      const result = await this.applyAnalysis(analysis);
      await this.persist();
      new Notice(`Synced ${result.decisions} decisions, ${result.risks} risks, ${result.issues} issues, ${result.executive} executive follow-ups and ${result.personFiles} person pages.`);
    }).open();
  }

  async previewCurrentFolder() {
    const active = this.app.workspace.getActiveFile();
    if (!active) return new Notice("No active note.");
    const folder = active.parent?.path || "";
    const files = this.app.vault.getMarkdownFiles().filter((f) => this.shouldProcess(f) && (f.parent?.path || "") === folder);
    await this.previewBatch(`Sync folder: ${folder || "Vault root"}`, files);
  }

  async previewEntireVault() {
    await this.previewBatch("Sync entire vault", this.app.vault.getMarkdownFiles().filter((f) => this.shouldProcess(f)));
  }

  async previewBatch(title, files) {
    if (!files.length) return new Notice("No eligible notes found.");
    const analyses = [];
    for (const file of files) analyses.push(await this.analyzeFile(file));
    new BatchPreviewModal(this.app, title, analyses, async () => {
      this.beginTransaction(title);
      let changed = 0;
      for (const analysis of analyses) {
        const result = await this.applyAnalysis(analysis);
        changed += result.personFiles;
      }
      await this.persist();
      new Notice(`Sync complete: ${analyses.length} notes and ${changed} person-page updates.`);
    }).open();
  }

  beginTransaction(label) { this.lastTransaction = { label, files: new Map() }; }

  async captureBefore(file) {
    if (!this.lastTransaction || this.lastTransaction.files.has(file.path)) return;
    this.lastTransaction.files.set(file.path, await this.app.vault.read(file));
  }

  async undoLastTransaction() {
    if (!this.lastTransaction) return new Notice("Nothing to undo.");
    const entries = [...this.lastTransaction.files.entries()].reverse();
    for (const [path, content] of entries) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (content === null) {
        if (file instanceof TFile) await this.app.vault.delete(file);
        continue;
      }
      if (file instanceof TFile) {
        this.processingPaths.add(path);
        await this.app.vault.modify(file, content);
        this.processingPaths.delete(path);
      }
    }
    const count = entries.length;
    this.lastTransaction = null;
    new Notice(`Undo complete: restored ${count} files.`);
  }

  async analyzeFile(file) {
    const content = await this.app.vault.cachedRead(file);
    const scoped = this.removeExcludedSections(content);
    const records = this.extractRecords(scoped, file);
    const scanContent = this.stripIgnoredContent(scoped);
    const tags = this.extractTags(scanContent);
    const people = this.extractResolvedPeople(scoped, file);
    const unresolvedLinks = [...new Set(records.flatMap((r) => r.unresolvedLinks))].sort();
    const affectedPersonPaths = [...new Set(records.flatMap((r) => r.people.map((p) => p.path)))];
    const signature = JSON.stringify({
      tags,
      people: people.map((p) => p.path),
      records: records.map((r) => ({ id: r.id, type: r.type, text: r.text, people: r.people.map((p) => p.path), unresolved: r.unresolvedLinks }))
    });
    const indexed = this.index[file.path];
    return {
      file,
      content,
      tags,
      people,
      records,
      unresolvedLinks,
      affectedPersonPaths,
      autoCreatePeople: this.settings.autoCreatePeople,
      signature,
      sourceWillChange: !indexed || indexed.signature !== signature
    };
  }

  async syncFile(file, showNotice = false) {
    const analysis = await this.analyzeFile(file);
    this.beginTransaction(`Automatic sync ${file.basename}`);
    const result = await this.applyAnalysis(analysis);
    await this.persist();
    if (showNotice) new Notice(`Synced ${result.decisions} decisions, ${result.risks} risks, ${result.issues} issues and ${result.executive} executive follow-ups.`);
  }

  async applyAnalysis(initialAnalysis) {
    const file = initialAnalysis.file;
    if (this.processingPaths.has(file.path)) return { decisions: 0, risks: 0, issues: 0, executive: 0, personFiles: 0 };
    this.processingPaths.add(file.path);
    try {
      if (this.settings.autoCreatePeople) {
        for (const target of initialAnalysis.unresolvedLinks) await this.createPersonFile(target);
      }

      const analysis = this.settings.autoCreatePeople && initialAnalysis.unresolvedLinks.length
        ? await this.analyzeFile(file)
        : initialAnalysis;

      await this.captureBefore(file);
      await this.updateSourceFrontmatter(file, analysis);

      const sourceDate = this.getSourceDate(file);
      const sourceLink = `[[${file.path.replace(/\.md$/i, "")}|${file.basename}]]`;
      const personFiles = await this.syncRecordBlocksToPeople(analysis.records, file.path, sourceLink, sourceDate);
      await this.syncRecordNotes(analysis.records, file, sourceLink, sourceDate);
      await this.ensureKnowledgeBase();

      this.index[file.path] = {
        signature: analysis.signature,
        syncedAt: new Date().toISOString(),
        tags: analysis.tags,
        people: analysis.people.map((p) => p.path),
        records: analysis.records.map((r) => ({ id: r.id, type: r.type, text: r.text, displayText: r.displayText, people: r.people.map((p) => p.path) }))
      };

      return {
        decisions: analysis.records.filter((r) => r.type === "d").length,
        risks: analysis.records.filter((r) => r.type === "r").length,
        issues: analysis.records.filter((r) => r.type === "i").length,
        executive: analysis.records.filter((r) => r.type === "e").length,
        personFiles
      };
    } finally {
      this.processingPaths.delete(file.path);
    }
  }

  cleanHeading(text) {
    return text.replace(/[#]+$/, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  removeExcludedSections(text) {
    const lines = text.split("\n");
    const kept = [];
    let excluding = false;
    let excludedLevel = null;
    const excluded = (this.settings.excludedHeadings || []).map((x) => x.toLowerCase().trim());
    for (const line of lines) {
      const match = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
      if (match) {
        const level = match[1].length;
        const heading = this.cleanHeading(match[2]);
        if (excluded.some((x) => heading.startsWith(x))) {
          excluding = true;
          excludedLevel = level;
          continue;
        }
        if (excluding && level <= excludedLevel) {
          excluding = false;
          excludedLevel = null;
        }
      }
      if (!excluding) kept.push(line);
    }
    return kept.join("\n");
  }

  stripIgnoredContent(text) {
    return text
      .replace(/^---\n[\s\S]*?\n---\n?/m, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/!\[\[.*?\]\]/g, "")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1");
  }

  extractTags(text) {
    return [...new Set((text.match(/#[\p{L}\p{N}_/-]+/gu) || []).map((x) => x.slice(1)))].sort();
  }

  parseWikiLinks(text) {
    const links = [];
    const regex = /(?<!!)\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[1].trim();
      const [targetPart, alias] = raw.split("|");
      const target = targetPart.split("#")[0].trim();
      if (target) links.push({ target, alias: alias?.trim() || null, raw: match[0] });
    }
    return links;
  }

  isPersonFile(file) {
    if (!(file instanceof TFile)) return false;
    const folder = normalizePath(this.settings.peopleFolder);
    const inPeopleFolder = file.path === folder || file.path.startsWith(folder + "/");
    const type = this.app.metadataCache.getFileCache(file)?.frontmatter?.type;
    return inPeopleFolder || String(type || "").toLowerCase() === "person";
  }

  resolvePersonLink(link, sourceFile) {
    const destination = this.app.metadataCache.getFirstLinkpathDest(link.target, sourceFile.path);
    if (!(destination instanceof TFile) || !this.isPersonFile(destination)) return null;
    return {
      path: destination.path,
      basename: destination.basename,
      display: link.alias || link.target,
      canonicalLink: `[[${destination.path.replace(/\.md$/i, "")}|${link.alias || link.target}]]`
    };
  }

  extractResolvedPeople(text, sourceFile) {
    const byPath = new Map();
    for (const link of this.parseWikiLinks(text)) {
      const person = this.resolvePersonLink(link, sourceFile);
      if (person && !byPath.has(person.path)) byPath.set(person.path, person);
    }
    return [...byPath.values()].sort((a, b) => a.basename.localeCompare(b.basename));
  }

  cleanGeneratedText(text) {
    const parsed = this.parseInlineStatus(text);
    const struck = this.statusIsClosed(parsed.status) || /^~~[\s\S]*~~$/.test(parsed.text.trim());
    let value = parsed.text.trim().replace(/^~~|~~$/g, "");
    value = value
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, (_, target) => target.split("/").pop())
      .replace(/#([\p{L}\p{N}_/-]+)/gu, "$1")
      .replace(/\s+/g, " ")
      .trim();
    return struck ? `~~${value}~~` : value;
  }

  trailingRecordTags(text) {
    const unstruck = this.parseInlineStatus(text).text.trim().replace(/^~~|~~$/g, "");
    const match = unstruck.match(/((?:\s+#[\p{L}\p{N}_/-]+)+)\s*$/u);
    if (!match) return [];
    return [...match[1].matchAll(/#([\p{L}\p{N}_/-]+)/gu)].map((x) => x[1]);
  }

  personRecordDisplayText(text) {
    const parsed = this.parseInlineStatus(text);
    const struck = this.statusIsClosed(parsed.status) || /^~~[\s\S]*~~$/.test(parsed.text.trim());
    const clean = this.cleanGeneratedText(text).replace(/^~~|~~$/g, "");
    const tags = this.trailingRecordTags(text);
    const value = tags.length ? `${clean} ${tags.join(" ")}` : clean;
    return struck ? `~~${value}~~` : value;
  }

  canonicalRecordText(text) {
    return this.cleanGeneratedText(text).replace(/^~~|~~$/g, "").toLowerCase();
  }

  makeRecordId(sourcePath, type, text, occurrence) {
    const input = `${sourcePath}|${type}|${this.canonicalRecordText(text)}|${occurrence}`;
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `akos-${(hash >>> 0).toString(36)}`;
  }

  extractRecords(text, sourceFile) {
    const records = [];
    const occurrences = new Map();
    for (const line of text.split("\n")) {
      const match = line.match(/^\s*(?:[-*+]\s*)?(d|r|i|e)::\s*(.+?)\s*$/i);
      if (!match) continue;
      const type = match[1].toLowerCase();
      const parsedStatus = this.parseInlineStatus(match[2]);
      const recordText = parsedStatus.text.replace(/\s+/g, " ").trim();
      if (!recordText) continue;
      const peopleByPath = new Map();
      const unresolvedLinks = [];
      for (const link of this.parseWikiLinks(recordText)) {
        const destination = this.app.metadataCache.getFirstLinkpathDest(link.target, sourceFile.path);
        if (!destination) {
          unresolvedLinks.push(link.target);
          continue;
        }
        if (!this.isPersonFile(destination)) continue;
        const person = this.resolvePersonLink(link, sourceFile);
        if (person) peopleByPath.set(person.path, person);
      }
      const occurrenceKey = `${type}|${this.canonicalRecordText(recordText)}`;
      const occurrence = (occurrences.get(occurrenceKey) || 0) + 1;
      occurrences.set(occurrenceKey, occurrence);
      records.push({
        id: this.makeRecordId(sourceFile.path, type, recordText, occurrence),
        type,
        text: recordText,
        status: parsedStatus.status,
        doneDate: parsedStatus.doneDate,
        displayText: this.cleanGeneratedText(recordText),
        personDisplayText: this.personRecordDisplayText(recordText),
        people: [...peopleByPath.values()],
        unresolvedLinks
      });
    }
    return records;
  }

  normalizeArray(value) {
    return Array.isArray(value) ? value.map(String) : value == null || value === "" ? [] : [String(value)];
  }

  async updateSourceFrontmatter(file, analysis) {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.tags = [...new Set([...this.normalizeArray(fm.tags), ...analysis.tags])];
      fm.people = analysis.people.map((p) => `[[${p.basename}]]`);

      for (const [type, definition] of Object.entries(RECORD_TYPES)) {
        const values = analysis.records.filter((r) => r.type === type).map((r) => r.displayText);
        if (values.length) fm[definition.key] = values;
        else delete fm[definition.key];
        const flag = `has_${definition.key}`;
        if (values.length) fm[flag] = true;
        else delete fm[flag];
      }

      delete fm.attendees;
      delete fm.unknown_attendees;
      delete fm.decision_required;
      delete fm.decision_proceed;
      delete fm.decision_declined;
      delete fm.has_decisions_old;
    });
  }

  getSourceDate(file) {
    const value = this.app.metadataCache.getFileCache(file)?.frontmatter?.date;
    if (value) {
      const text = String(value).trim();
      const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      return match ? match[1] : text;
    }
    return file.basename.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]
      || file.path.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]
      || window.moment(file.stat.ctime).format("YYYY-MM-DD");
  }

  async ensureFolder(path) {
    let current = "";
    for (const part of normalizePath(path).split("/")) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }

  safeFileName(name) {
    return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  }

  async createPersonFile(target) {
    const folder = normalizePath(this.settings.peopleFolder);
    await this.ensureFolder(folder);
    const displayName = this.safeFileName(target.split("/").pop());
    if (!displayName) return;
    const path = normalizePath(`${folder}/${displayName}.md`);
    if (this.app.vault.getAbstractFileByPath(path)) return;

    let content = "---\ntype: person\naliases:\n  - {{name}}\n---\n\n# {{name}}\n";
    const template = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.personTemplatePath));
    if (template instanceof TFile) content = await this.app.vault.cachedRead(template);
    content = content
      .replace(/<%\s*tp\.file\.title\s*%>/g, displayName)
      .replace(/\{\{name\}\}/g, displayName);

    const file = await this.app.vault.create(path, content);
    if (this.lastTransaction) this.lastTransaction.files.set(path, null);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.type = "person";
      const aliases = this.normalizeArray(fm.aliases);
      if (!aliases.includes(displayName)) aliases.push(displayName);
      fm.aliases = aliases;
    });
  }

  recordFolder(type) {
    const definition = RECORD_TYPES[type];
    return normalizePath(this.settings[definition.folderSetting]);
  }

  yamlQuote(value) {
    return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  recordFileName(record, date) {
    const clean = this.cleanGeneratedText(record.text).replace(/^~~|~~$/g, "");
    const short = this.safeFileName(clean).slice(0, 72).replace(/[. ]+$/g, "") || RECORD_TYPES[record.type].singular;
    return `${date} - ${short} - ${record.id}.md`;
  }

  buildRecordNote(record, sourceFile, sourceLink, date) {
    const definition = RECORD_TYPES[record.type];
    const sentence = this.cleanGeneratedText(record.text).replace(/^~~|~~$/g, "");
    const closed = this.statusIsClosed(record.status) || /^~~[\s\S]*~~$/.test(record.text.trim());
    const owners = record.people.map((p) => `  - ${this.yamlQuote(`[[${p.basename}]]`)}`);
    const tags = this.trailingRecordTags(record.text).map((tag) => `  - ${this.yamlQuote(tag)}`);
    const lines = [
      "---",
      `type: ${definition.typeName}`,
      `sentence: ${this.yamlQuote(sentence)}`,
      "owner:",
      ...(owners.length ? owners : ["  - Unassigned"]),
      `source: ${this.yamlQuote(`[[${sourceFile.basename}]]`)}`,
      `source_path: ${this.yamlQuote(sourceFile.path)}`,
      `date: ${date}`,
      `status: ${record.status ? this.normalizedStatus(record.status) : (closed ? "Done" : "Open")}`,
      ...(closed && record.doneDate ? [`completed_date: ${record.doneDate}`] : []),
      `record_id: ${record.id}`
    ];
    if (tags.length) lines.push("tags:", ...tags);
    lines.push("---", "", sentence, "", `Source: ${sourceLink}`, "");
    return lines.join("\n");
  }

  async syncRecordNotes(records, sourceFile, sourceLink, date) {
    const expected = new Set();
    for (const record of records) {
      const folder = this.recordFolder(record.type);
      await this.ensureFolder(folder);
      const path = normalizePath(`${folder}/${this.recordFileName(record, date)}`);
      expected.add(path);
      const content = this.buildRecordNote(record, sourceFile, sourceLink, date);
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        const current = await this.app.vault.cachedRead(existing);
        if (current !== content) {
          await this.captureBefore(existing);
          this.processingPaths.add(existing.path);
          await this.app.vault.modify(existing, content);
          this.processingPaths.delete(existing.path);
        }
      } else {
        await this.app.vault.create(path, content);
        if (this.lastTransaction) this.lastTransaction.files.set(path, null);
      }
    }

    for (const definition of Object.values(RECORD_TYPES)) {
      const folder = normalizePath(this.settings[definition.folderSetting]);
      const prefix = folder + "/";
      for (const candidate of this.app.vault.getMarkdownFiles()) {
        if (!candidate.path.startsWith(prefix)) continue;
        const fm = this.app.metadataCache.getFileCache(candidate)?.frontmatter;
        if (fm?.source_path !== sourceFile.path || !fm?.record_id) continue;
        if (expected.has(candidate.path)) continue;
        await this.captureBefore(candidate);
        await this.app.vault.delete(candidate);
      }
    }
  }

  buildKnowledgeBaseContent() {
    return [
      "filters:",
      "  or:",
      "    - 'type == \"decision\"'",
      "    - 'type == \"risk\"'",
      "    - 'type == \"issue\"'",
      "    - 'type == \"executive-follow-up\"'",
      "properties:",
      "  type:",
      "    displayName: Type",
      "  sentence:",
      "    displayName: Sentence",
      "  owner:",
      "    displayName: Owner",
      "  source:",
      "    displayName: Source File",
      "  status:",
      "    displayName: Status",
      "  date:",
      "    displayName: Date",
      "views:",
      "  - type: table",
      "    name: All Open Items",
      "    filters:",
      "      and:",
      "        - 'status != \"Done\"'",
      "    order:",
      "      - type",
      "      - sentence",
      "      - owner",
      "      - source",
      "      - status",
      "      - date",
      "  - type: table",
      "    name: Executive Follow-ups",
      "    filters:",
      "      and:",
      "        - 'type == \"executive-follow-up\"'",
      "    order:",
      "      - sentence",
      "      - owner",
      "      - source",
      "      - status",
      "      - date",
      "  - type: table",
      "    name: Decisions",
      "    filters:",
      "      and:",
      "        - 'type == \"decision\"'",
      "    order:",
      "      - sentence",
      "      - owner",
      "      - source",
      "      - status",
      "      - date",
      "  - type: table",
      "    name: Risks",
      "    filters:",
      "      and:",
      "        - 'type == \"risk\"'",
      "    order:",
      "      - sentence",
      "      - owner",
      "      - source",
      "      - status",
      "      - date",
      "  - type: table",
      "    name: Issues",
      "    filters:",
      "      and:",
      "        - 'type == \"issue\"'",
      "    order:",
      "      - sentence",
      "      - owner",
      "      - source",
      "      - status",
      "      - date",
      "  - type: table",
      "    name: By Owner",
      "    filters:",
      "      and:",
      "        - 'status != \"Done\"'",
      "    groupBy:",
      "      property: owner",
      "      direction: ASC",
      "    order:",
      "      - type",
      "      - sentence",
      "      - source",
      "      - status",
      "      - date",
      "  - type: table",
      "    name: Recently Done",
      "    filters:",
      "      and:",
      "        - 'status == \"Done\"'",
      "    order:",
      "      - date",
      "      - type",
      "      - sentence",
      "      - owner",
      "      - source",
      "",
    ].join("\n");
  }

  async ensureKnowledgeBase() {
    const folder = normalizePath(this.settings.dashboardFolder || "01.Home/Dashboards");
    await this.ensureFolder(folder);
    const rawName = String(this.settings.dashboardBaseName || "00.🎛️ Master").trim().replace(/\.base$/i, "");
    const baseName = this.safeFileName(rawName) || "00.🎛️ Master";
    const path = normalizePath(`${folder}/${baseName}.base`);
    if (this.app.vault.getAbstractFileByPath(path)) return;
    await this.app.vault.create(path, this.buildKnowledgeBaseContent());
    if (this.lastTransaction) this.lastTransaction.files.set(path, null);
  }

  escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  buildManagedBlock(records, personPath, type, sourcePath, sourceLink, date, start, end) {
    const relevant = records.filter((r) => r.type === type && r.people.some((p) => p.path === personPath));
    if (!relevant.length) return "";
    const lines = relevant.flatMap((r) => [
      `<!-- aceto-knowledge-os-record:${r.id}:${encodeURIComponent(sourcePath)}:${type} -->`,
      `- ${r.personDisplayText || r.displayText}`
    ]);
    return [start, `#### ${date} · ${sourceLink}`, ...lines, end].join("\n");
  }

  async syncRecordBlocksToPeople(records, sourcePath, sourceLink, date) {
    const sourceKey = encodeURIComponent(sourcePath);
    let updated = 0;
    const peopleFiles = this.app.vault.getMarkdownFiles().filter((f) => this.isPersonFile(f));

    for (const personFile of peopleFiles) {
      let content = await this.app.vault.cachedRead(personFile);
      const original = content;

      // Remove the legacy v0.2 decision block for this source during migration.
      const legacyStart = `<!-- aceto-metadata-sync:${sourceKey}:start -->`;
      const legacyEnd = `<!-- aceto-metadata-sync:${sourceKey}:end -->`;
      const legacyPattern = new RegExp(`${this.escapeRegExp(legacyStart)}[\\s\\S]*?${this.escapeRegExp(legacyEnd)}\\n?`, "g");
      content = content.replace(legacyPattern, "");

      // Risks are surfaced through Dataview on person pages. Remove any legacy
      // plugin-managed risk mirrors, regardless of which source note created them.
      const allRiskBlocks = /<!-- aceto-knowledge-os:[^\n:]+:risks:start -->[\s\S]*?<!-- aceto-knowledge-os:[^\n:]+:risks:end -->\n?/g;
      content = content.replace(allRiskBlocks, "");

      for (const [type, definition] of Object.entries(RECORD_TYPES)) {
        const start = `<!-- aceto-knowledge-os:${sourceKey}:${definition.key}:start -->`;
        const end = `<!-- aceto-knowledge-os:${sourceKey}:${definition.key}:end -->`;
        const pattern = new RegExp(`${this.escapeRegExp(start)}[\\s\\S]*?${this.escapeRegExp(end)}\\n?`, "g");
        const block = type === "r"
          ? ""
          : this.buildManagedBlock(records, personFile.path, type, sourcePath, sourceLink, date, start, end);

        content = content.replace(pattern, "").replace(/\s+$/, "");
        if (block) {
          const headingPattern = new RegExp(`^#{1,6}\\s+${this.escapeRegExp(definition.heading)}\\s*$`, "im");
          if (!headingPattern.test(content)) content += `\n\n### ${definition.heading}`;
          content += `\n\n${block}`;
        }
      }

      // Remove an orphaned Risks heading only when it contains no manual content.
      content = content.replace(/^#{1,6}\s+Risks\s*\n(?=\s*(?:#{1,6}\s|$))/gim, "");

      content = content.trimEnd() + "\n";
      if (content === original) continue;
      await this.captureBefore(personFile);
      this.processingPaths.add(personFile.path);
      await this.app.vault.modify(personFile, content);
      this.processingPaths.delete(personFile.path);
      updated++;
    }
    return updated;
  }

  async syncKnowledgeOSStatusChanges() {
    const managedFolders = [this.settings.executiveFolder, this.settings.decisionsFolder, this.settings.risksFolder, this.settings.issuesFolder]
      .map((folder) => normalizePath(folder || ""))
      .filter(Boolean);
    const recordFiles = this.app.vault.getMarkdownFiles().filter((file) => {
      const path = normalizePath(file.path);
      return managedFolders.some((folder) => path.startsWith(folder + "/"));
    });
    if (!recordFiles.length) {
      new Notice("No Knowledge OS records were found.");
      return;
    }

    let changed = 0;
    let failed = 0;
    for (const recordFile of recordFiles) {
      try {
        if (await this.syncRecordStatusToSource(recordFile)) changed++;
      } catch (error) {
        console.error("ACE2X Knowledge OS status synchronization failed", recordFile.path, error);
        failed++;
      }
    }

    if (failed) {
      new Notice(`Knowledge OS status sync completed: ${changed} changed, ${failed} failed.`);
    } else if (changed) {
      new Notice(`Knowledge OS status sync completed: ${changed} source item${changed === 1 ? "" : "s"} updated.`);
    } else {
      new Notice("Knowledge OS status sync completed. No status changes were found.");
    }
  }


  readSimpleFrontmatter(content) {
    const match = String(content || "").match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
    if (!match) return {};
    const result = {};
    for (const line of match[1].split("\n")) {
      const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
      if (!field) continue;
      let value = field[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[field[1]] = value;
    }
    return result;
  }

  async syncRecordStatusToSource(recordFile) {
    const recordContent = await this.app.vault.read(recordFile);
    const fm = this.readSimpleFrontmatter(recordContent);
    if (!fm?.record_id || !fm?.source_path) return false;

    const sourcePath = String(fm.source_path);
    const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(sourceFile instanceof TFile) || !this.shouldProcess(sourceFile)) return false;

    const indexed = this.index[sourcePath];
    const indexedRecord = indexed?.records?.find((record) => record.id === String(fm.record_id));
    if (!indexedRecord) return false;

    const desiredStatus = this.normalizedStatus(fm.status || "open");
    const original = await this.app.vault.cachedRead(sourceFile);
    let changed = false;
    const updated = original.split("\n").map((line) => {
      const match = line.match(/^(\s*(?:[-*+]\s*)?(d|r|i|e)::\s*)(.+?)(\s*)$/i);
      if (!match || match[2].toLowerCase() !== indexedRecord.type) return line;
      const parsedSourceStatus = this.parseInlineStatus(match[3]);
      if (this.canonicalRecordText(parsedSourceStatus.text) !== this.canonicalRecordText(indexedRecord.text)) return line;
      const nextBody = this.withInlineStatus(match[3], desiredStatus);
      const nextLine = `${match[1]}${nextBody}${match[4]}`;
      if (nextLine !== line) changed = true;
      return nextLine;
    }).join("\n");

    if (!changed) return false;
    this.processingPaths.add(sourcePath);
    try {
      await this.app.vault.modify(sourceFile, updated);
    } finally {
      this.processingPaths.delete(sourcePath);
    }

    const analysis = await this.analyzeFile(sourceFile);
    await this.applyAnalysis(analysis);
    await this.persist();
    return true;
  }

  async syncPersonStatusesToSources(personFile) {
    const content = await this.app.vault.cachedRead(personFile);
    const lines = content.split("\n");
    const changes = [];
    const markerPattern = /^<!-- aceto-knowledge-os-record:([^:]+):([^:]+):(d|r|i|e) -->$/;

    for (let i = 0; i < lines.length - 1; i++) {
      const marker = lines[i].trim().match(markerPattern);
      if (!marker) continue;
      const item = lines[i + 1].match(/^\s*-\s+(.+?)\s*$/);
      if (!item) continue;
      changes.push({
        id: marker[1],
        sourcePath: decodeURIComponent(marker[2]),
        type: marker[3],
        struck: /^~~[\s\S]*~~$/.test(item[1].trim())
      });
    }

    const bySource = new Map();
    for (const change of changes) {
      if (!bySource.has(change.sourcePath)) bySource.set(change.sourcePath, []);
      bySource.get(change.sourcePath).push(change);
    }

    for (const [sourcePath, sourceChanges] of bySource) {
      const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
      if (!(sourceFile instanceof TFile) || !this.shouldProcess(sourceFile)) continue;
      const indexed = this.index[sourcePath];
      if (!indexed?.records?.length) continue;
      const stateById = new Map(sourceChanges.map((x) => [x.id, x.struck]));
      const recordByCanonical = new Map();
      for (const record of indexed.records) {
        if (!record.id || !stateById.has(record.id)) continue;
        recordByCanonical.set(`${record.type}|${this.canonicalRecordText(record.text)}`, {
          struck: stateById.get(record.id),
          id: record.id
        });
      }
      if (!recordByCanonical.size) continue;

      const original = await this.app.vault.cachedRead(sourceFile);
      const updated = original.split("\n").map((line) => {
        const match = line.match(/^(\s*(?:[-*+]\s*)?(d|r|i|e)::\s*)(.+?)(\s*)$/i);
        if (!match) return line;
        const parsedSourceStatus = this.parseInlineStatus(match[3]);
        const key = `${match[2].toLowerCase()}|${this.canonicalRecordText(parsedSourceStatus.text)}`;
        const desired = recordByCanonical.get(key);
        if (!desired) return line;
        const desiredStatus = desired.struck ? "closed" : "open";
        const nextBody = this.withInlineStatus(match[3], desiredStatus);
        return `${match[1]}${nextBody}${match[4]}`;
      }).join("\n");

      if (updated === original) continue;
      this.processingPaths.add(sourcePath);
      try {
        await this.app.vault.modify(sourceFile, updated);
      } finally {
        this.processingPaths.delete(sourcePath);
      }
      const analysis = await this.analyzeFile(sourceFile);
      await this.applyAnalysis(analysis);
    }
    await this.persist();
  }
}

class ACE2XKnowledgeOSSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "ACE2X Knowledge OS" });

    new Setting(containerEl)
      .setName("Automatic sync")
      .setDesc("Process notes after saving. Manual preview is recommended.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
        this.plugin.settings.autoSync = value;
        await this.plugin.persist();
      }));

    const folderPaths = this.plugin.vaultFolderPaths();

    new Setting(containerEl)
      .setName("Auto-detect folders")
      .setDesc("Find likely People, Executive, Decisions, Risks, Issues and Dashboard folders when a configured location is missing.")
      .addButton((button) => button.setButtonText("Detect folders").onClick(async () => {
        const changed = await this.plugin.autoDetectFolders();
        new Notice(changed ? "Folder locations updated." : "No better folder matches were found.");
        this.display();
      }));

    this.addFolderPicker(containerEl, "People folder", "Folder containing person pages. Pages with type: person are also recognized elsewhere.", "peopleFolder", folderPaths);

    new Setting(containerEl)
      .setName("Person template")
      .setDesc("Template used when creating a missing person page.")
      .addText((text) => text.setValue(this.plugin.settings.personTemplatePath).onChange(async (value) => {
        this.plugin.settings.personTemplatePath = normalizePath(value.trim());
        await this.plugin.persist();
      }));

    this.addFolderPicker(containerEl, "Executive follow-up folder", "Folder for e:: record notes.", "executiveFolder", folderPaths);
    this.addFolderPicker(containerEl, "Decisions folder", "Folder for decision record notes.", "decisionsFolder", folderPaths);
    this.addFolderPicker(containerEl, "Risks folder", "Folder for risk record notes.", "risksFolder", folderPaths);
    this.addFolderPicker(containerEl, "Issues folder", "Folder for issue record notes.", "issuesFolder", folderPaths);
    this.addFolderPicker(containerEl, "Dashboard folder", "Folder where the master Base dashboard is created. Existing Base files are never overwritten.", "dashboardFolder", folderPaths);

    new Setting(containerEl)
      .setName("Dashboard Base name")
      .setDesc("Filename for the master Base. Enter a name without .base. Changing it creates the new Base on the next sync and does not delete the previous file.")
      .addText((text) => text.setPlaceholder("00.🎛️ Master").setValue(this.plugin.settings.dashboardBaseName || "00.🎛️ Master").onChange(async (value) => {
        this.plugin.settings.dashboardBaseName = value.trim().replace(/\.base$/i, "") || "00.🎛️ Master";
        await this.plugin.persist();
      }));

    new Setting(containerEl)
      .setName("Create unresolved links as people")
      .setDesc("Off by default. When enabled, unresolved links inside d::, r::, i:: or e:: records create person pages.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.autoCreatePeople).onChange(async (value) => {
        this.plugin.settings.autoCreatePeople = value;
        await this.plugin.persist();
      }));

    new Setting(containerEl)
      .setName("Excluded folders")
      .setDesc("Comma-separated vault paths.")
      .addTextArea((text) => text.setValue((this.plugin.settings.excludedFolders || []).join(", ")).onChange(async (value) => {
        this.plugin.settings.excludedFolders = value.split(",").map((x) => normalizePath(x.trim())).filter(Boolean);
        await this.plugin.persist();
      }));

    new Setting(containerEl)
      .setName("Excluded headings")
      .setDesc("Comma-separated heading prefixes ignored during analysis.")
      .addTextArea((text) => text.setValue((this.plugin.settings.excludedHeadings || []).join(", ")).onChange(async (value) => {
        this.plugin.settings.excludedHeadings = value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
        await this.plugin.persist();
      }));

    this.renderTermsReference(containerEl);
  }

  addFolderPicker(containerEl, name, description, settingKey, folderPaths) {
    const current = normalizePath(this.plugin.settings[settingKey] || "");
    const exists = current && this.app.vault.getAbstractFileByPath(current) instanceof TFolder;
    const setting = new Setting(containerEl)
      .setName(name)
      .setDesc(exists ? description : `${description} Current location is missing; select a folder or run auto-detect.`);

    setting.addDropdown((dropdown) => {
      if (current && !folderPaths.includes(current)) dropdown.addOption(current, `⚠ ${current} (missing)`);
      for (const path of folderPaths) dropdown.addOption(path, path);
      dropdown.setValue(current || folderPaths[0] || "");
      dropdown.onChange(async (value) => {
        this.plugin.settings[settingKey] = normalizePath(value);
        await this.plugin.persist();
        this.display();
      });
    });
    return setting;
  }

  renderTermsReference(containerEl) {
    containerEl.createEl("h3", { text: "Syntax reference" });
    const reference = containerEl.createDiv({ cls: "aceto-terms-reference" });
    const table = reference.createEl("table");
    const head = table.createEl("thead").createEl("tr");
    head.createEl("th", { text: "Syntax" });
    head.createEl("th", { text: "Meaning" });
    head.createEl("th", { text: "Example" });
    const body = table.createEl("tbody");
    const rows = [
      ["d::", "Decision", "d:: [[John Doe|JD]] approved the proposal."],
      ["r::", "Risk", "r:: Vendor delays may impact the schedule. [[John Doe]]"],
      ["i::", "Issue", "i:: Reporting currently requires administrator access."],
      ["e::", "Executive follow-up", "e:: Confirm FY27 funding with [[John Doe]]."],
      ["[[Name]]", "Person reference", "[[John Doe]] or an alias such as [[JD]]"],
      ["- [ ]", "Your task", "- [ ] Review licensing 📅 2026-07-31"],
      ["- Action [[Name]]", "Another person's action", "- Confirm pricing with the vendor. [[John Doe]]"],
      ["#Topic", "Tag", "#Infrastructure or #IAM"],
      ["s::o / s::d", "Inline status", "d:: [[John Doe]] Approve the proposal. #Infrastructure s::o"],
      ["done::", "Completion date", "~~d:: [[John Doe]] Approve the proposal. s::d done::2026-07-18~~"],
      ["~~text~~", "Completed-record formatting", "~~d:: Decision approved. s::d done::2026-07-18~~"]
    ];
    for (const row of rows) {
      const tr = body.createEl("tr");
      tr.createEl("td").createEl("code", { text: row[0] });
      tr.createEl("td", { text: row[1] });
      tr.createEl("td").createEl("code", { text: row[2] });
    }

    const notes = reference.createEl("div", { cls: "aceto-reference-notes" });
    notes.createEl("p", { text: "Aliases are resolved by Obsidian. A link such as [[JD]] resolves to the person page whose aliases include JD." });
    notes.createEl("p", { text: "Only links resolving to a person page are synchronized to People pages. A person page is recognized by its location in the People folder or by type: person in frontmatter." });
    notes.createEl("p", { text: "Use s:: inline at the end of a record. Write s::o for Open and s::d for Done. The aliases s::c, done, closed, and complete are accepted and normalized. Base status edits synchronize back to the compact inline value." });
    notes.createEl("p", { text: "When a record becomes Done, synchronization applies strikethrough and adds done:: YYYY-MM-DD. Reopening removes both the strikethrough and completion date." });
    notes.createEl("p", { text: "Editing, changing status, removing a person, or deleting a record updates every associated person page the next time the source note is synced." });
  }
}

