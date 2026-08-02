export function highlightRecordMarkersInElement(el: HTMLElement, typeKeys: string[]): void {
  if (!typeKeys.length) return;
  const pattern = new RegExp(`^(\\s*)(${typeKeys.join("|")})(::)`, "i");

  const containers: Element[] = [];
  if (el.matches?.("p, li")) containers.push(el);
  containers.push(...Array.from(el.querySelectorAll("p, li")));

  for (const container of containers) {
    let atLineStart = true;
    for (const node of Array.from(container.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "BR") {
        atLineStart = true;
        continue;
      }
      if (!atLineStart) continue;
      atLineStart = false;
      if (node.nodeType !== Node.TEXT_NODE) continue;

      const text = node.textContent || "";
      const match = text.match(pattern);
      if (!match) continue;
      const type = match[2].toLowerCase();
      const leadLen = match[1].length;
      const markerLen = match[2].length + match[3].length;

      const before = text.slice(0, leadLen);
      const marker = text.slice(leadLen, leadLen + markerLen);
      const after = text.slice(leadLen + markerLen);

      const span = document.createElement("span");
      span.className = `aceto-type-marker-${type}`;
      span.textContent = marker;

      const parent = node.parentNode;
      if (!parent) continue;
      parent.insertBefore(document.createTextNode(before), node);
      parent.insertBefore(span, node);
      parent.insertBefore(document.createTextNode(after), node);
      parent.removeChild(node);
    }
  }
}
