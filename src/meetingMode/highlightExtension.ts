import { StateEffect } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export const setHighlightLines = StateEffect.define<number[]>();

const highlightLineDeco = Decoration.line({ attributes: { class: "aceto-mm-line-highlight" } });

export const highlightLinesPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    update(update: ViewUpdate): void {
      if (update.docChanged) this.decorations = this.decorations.map(update.changes);
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (!effect.is(setHighlightLines)) continue;
          const lineNumbers = effect.value;
          if (!lineNumbers.length) {
            this.decorations = Decoration.none;
            continue;
          }
          const ranges = [];
          for (const lineNumber of lineNumbers) {
            if (lineNumber < 1 || lineNumber > update.state.doc.lines) continue;
            const line = update.state.doc.line(lineNumber);
            ranges.push(highlightLineDeco.range(line.from));
          }
          this.decorations = Decoration.set(ranges, true);
        }
      }
    }
  },
  { decorations: (v) => v.decorations }
);
