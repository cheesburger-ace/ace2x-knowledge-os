import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  Modal,
  TFile
} from "obsidian";

interface DueDateSuggestion {
  label: string;
}

const INSERT_TEXT = "[due:: ";

export class DueDateSuggest extends EditorSuggest<DueDateSuggestion> {
  private typeKeys: string[];

  constructor(app: App, typeKeys: string[]) {
    super(app);
    this.typeKeys = typeKeys;
  }

  onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
    if (!this.typeKeys.length) return null;
    const line = editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);
    const recordLinePattern = new RegExp(`^\\s*(?:[-*+]\\s*)?(${this.typeKeys.join("|")})::`, "i");
    const taskLinePattern = /^\s*[-*+]\s*\[.\]/;
    if (!recordLinePattern.test(line) && !taskLinePattern.test(line)) return null;

    const triggerMatch = beforeCursor.match(/\[(\w*)$/);
    if (!triggerMatch) return null;

    return {
      start: { line: cursor.line, ch: cursor.ch - triggerMatch[0].length },
      end: cursor,
      query: triggerMatch[1]
    };
  }

  getSuggestions(context: EditorSuggestContext): DueDateSuggestion[] {
    const query = context.query.toLowerCase();
    return "due".startsWith(query) ? [{ label: "due::" }] : [];
  }

  renderSuggestion(suggestion: DueDateSuggestion, el: HTMLElement): void {
    el.createEl("div", { text: suggestion.label });
    el.createEl("small", { text: "Insert a due date", cls: "aceto-suggest-desc" });
  }

  selectSuggestion(_suggestion: DueDateSuggestion): void {
    const context = this.context;
    if (!context) return;
    const editor = context.editor;

    editor.replaceRange(INSERT_TEXT, context.start, context.end);
    const insertPos: EditorPosition = { line: context.start.line, ch: context.start.ch + INSERT_TEXT.length };
    editor.setCursor(insertPos);

    new DueDateModal(this.app, (isoDate) => {
      if (!isoDate) return;
      editor.replaceRange(`${isoDate}]`, insertPos, insertPos);
      editor.setCursor({ line: insertPos.line, ch: insertPos.ch + isoDate.length + 1 });
      editor.focus();
    }).open();
  }
}

export class DueDateModal extends Modal {
  private onSubmit: (isoDate: string | null) => void;

  constructor(app: App, onSubmit: (isoDate: string | null) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Insert due date" });

    const input = contentEl.createEl("input", { attr: { type: "date" } }) as HTMLInputElement;
    input.focus();

    const quickRow = contentEl.createDiv({ cls: "aceto-due-quick-row" });
    const addQuick = (label: string, days: number) => {
      const btn = quickRow.createEl("button", { text: label });
      btn.addEventListener("click", () => {
        const target = new Date();
        target.setDate(target.getDate() + days);
        input.value = target.toISOString().slice(0, 10);
      });
    };
    addQuick("Today", 0);
    addQuick("Tomorrow", 1);
    addQuick("Next week", 7);

    const actions = contentEl.createDiv({ cls: "aceto-preview-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => {
      this.onSubmit(null);
      this.close();
    };
    const insert = actions.createEl("button", { cls: "mod-cta", text: "Insert" });
    insert.onclick = () => {
      this.onSubmit(input.value || null);
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
