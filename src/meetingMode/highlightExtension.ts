import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

export const setHighlightLines = StateEffect.define<number[]>();

const highlightLineDeco = Decoration.line({ attributes: { class: "aceto-mm-line-highlight" } });

export const highlightLinesField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setHighlightLines)) continue;
      const lineNumbers = effect.value;
      if (!lineNumbers.length) {
        deco = Decoration.none;
        continue;
      }
      const ranges = [];
      for (const lineNumber of lineNumbers) {
        if (lineNumber < 1 || lineNumber > tr.state.doc.lines) continue;
        const line = tr.state.doc.line(lineNumber);
        ranges.push(highlightLineDeco.range(line.from));
      }
      deco = Decoration.set(ranges, true);
    }
    return deco;
  },
  provide: (field) => EditorView.decorations.from(field)
});
