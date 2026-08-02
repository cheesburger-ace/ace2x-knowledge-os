import { Facet, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

export interface TypeColorEntry {
  type: string;
  className: string;
}

export const recordMarkerColors = Facet.define<TypeColorEntry[], TypeColorEntry[]>({
  combine: (values) => values[0] || []
});

function buildDecorations(view: EditorView): DecorationSet {
  const colors = view.state.facet(recordMarkerColors);
  if (!colors.length) return Decoration.none;
  const byType = new Map(colors.map((c) => [c.type, c.className]));
  const pattern = new RegExp(`^(\\s*(?:[-*+]\\s*)?)(${colors.map((c) => c.type).join("|")})(::)`, "i");
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const match = line.text.match(pattern);
      if (match) {
        const type = match[2].toLowerCase();
        const className = byType.get(type);
        if (className) {
          const startOffset = line.from + match[1].length;
          const endOffset = startOffset + match[2].length + match[3].length;
          builder.add(startOffset, endOffset, Decoration.mark({ class: className }));
        }
      }
      if (line.to >= view.state.doc.length) break;
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

export const recordMarkerHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
