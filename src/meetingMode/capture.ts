import type { App, TFile } from "obsidian";

export interface CaptureOwner {
  basename: string;
  canonicalLink: string;
}

export interface ParsedCapture {
  type: string | null;
  body: string;
}

export function parseCaptureInput(raw: string, typeKeys: string[]): ParsedCapture {
  const trimmed = raw.trim();
  if (!trimmed) return { type: null, body: "" };
  const pattern = new RegExp(`^(${typeKeys.join("|")})::\\s*(.+)$`, "i");
  const match = trimmed.match(pattern);
  if (!match) return { type: null, body: trimmed };
  return { type: match[1].toLowerCase(), body: match[2].trim() };
}

export function buildCaptureLine(parsed: ParsedCapture, owner: CaptureOwner | null, bodyHasPersonLink: boolean): string {
  if (!parsed.type) return `- ${parsed.body}`;
  const body = !bodyHasPersonLink && owner ? `${parsed.body} ${owner.canonicalLink}` : parsed.body;
  return `- ${parsed.type}:: ${body} s::o`;
}

export async function appendLineToFile(app: App, file: TFile, line: string): Promise<void> {
  const content = await app.vault.read(file);
  const separator = content.length && !content.endsWith("\n") ? "\n" : "";
  await app.vault.modify(file, `${content}${separator}${line}\n`);
}
