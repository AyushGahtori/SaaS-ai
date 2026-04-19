"use client";

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.type}-${file.lastModified}`;
}

function dedupeFiles(files: File[]): File[] {
  const seen: Record<string, boolean> = {};
  const deduped: File[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const key = fileKey(file);
    if (seen[key]) continue;
    seen[key] = true;
    deduped.push(file);
  }
  return deduped;
}

function extensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase().trim();
  if (!normalized) return "bin";
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "image/jpeg") return "jpg";
  if (normalized.startsWith("image/")) {
    const raw = normalized.slice("image/".length);
    const clean = raw.split("+")[0].trim();
    return clean || "png";
  }
  return "bin";
}

function mimeTypeSupported(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase();
  return normalized.startsWith("image/") || normalized === "application/pdf";
}

function safeAtob(value: string): string {
  const normalized = value.replace(/\s+/g, "");
  return atob(normalized);
}

function decodeDataUrlToFile(dataUrl: string, index: number): File | null {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:")) return null;

  const commaIndex = trimmed.indexOf(",");
  if (commaIndex <= 5) return null;

  const meta = trimmed.slice(5, commaIndex);
  const payload = trimmed.slice(commaIndex + 1);
  const [mimeTypeRaw = "application/octet-stream"] = meta.split(";");
  const mimeType = mimeTypeRaw.toLowerCase().trim();
  const isBase64 = meta.toLowerCase().includes(";base64");

  if (!mimeTypeSupported(mimeType)) return null;
  if (!payload) return null;

  try {
    let bytes: Uint8Array;
    if (isBase64) {
      const binary = safeAtob(payload);
      bytes = new Uint8Array(binary.length);
      for (let byteIndex = 0; byteIndex < binary.length; byteIndex += 1) {
        bytes[byteIndex] = binary.charCodeAt(byteIndex);
      }
    } else {
      const decoded = decodeURIComponent(payload);
      const encoder = new TextEncoder();
      bytes = encoder.encode(decoded);
    }

    const normalizedBytes = new Uint8Array(bytes.byteLength);
    normalizedBytes.set(bytes);

    const extension = extensionFromMimeType(mimeType);
    const timestamp = Date.now();
    return new File([normalizedBytes], `pasted-${timestamp}-${index + 1}.${extension}`, {
      type: mimeType,
      lastModified: timestamp,
    });
  } catch {
    return null;
  }
}

function extractDataUrls(text: string): string[] {
  const matches = text.match(/data:[^"'`\s)>]+/g);
  if (!matches) return [];
  return matches;
}

function filesFromClipboardText(text: string): File[] {
  if (!text) return [];
  const dataUrls = extractDataUrls(text);
  if (dataUrls.length === 0) return [];

  const files: File[] = [];
  for (let index = 0; index < dataUrls.length; index += 1) {
    const file = decodeDataUrlToFile(dataUrls[index], index);
    if (file && file.size > 0) files.push(file);
  }
  return files;
}

export function extractClipboardFiles(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) return [];

  const fromItems: File[] = [];
  const items = clipboardData.items ? Array.from(clipboardData.items) : [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && file.size > 0) fromItems.push(file);
  }

  const fromFiles = clipboardData.files ? Array.from(clipboardData.files) : [];
  const immediate = dedupeFiles(fromItems.concat(fromFiles));
  if (immediate.length > 0) return immediate;

  // Edge/Windows clipboard often exposes screenshots as text/html data URLs.
  const htmlText = clipboardData.getData("text/html");
  const plainText = clipboardData.getData("text/plain");
  return dedupeFiles(filesFromClipboardText(htmlText).concat(filesFromClipboardText(plainText)));
}

export async function readClipboardFilesFallback(): Promise<File[]> {
  if (typeof navigator === "undefined") return [];
  const clipboard = navigator.clipboard;
  if (!clipboard) return [];

  try {
    if (typeof clipboard.read === "function") {
      const items = await clipboard.read();
      const files: File[] = [];

      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        const item = items[itemIndex];
        const types = Array.isArray(item.types) ? item.types : [];

        for (let typeIndex = 0; typeIndex < types.length; typeIndex += 1) {
          const mimeType = types[typeIndex];
          if (!mimeTypeSupported(mimeType)) continue;

          const blob = await item.getType(mimeType);
          const extension = extensionFromMimeType(mimeType);
          const timestamp = Date.now();
          files.push(
            new File([blob], `pasted-${timestamp}-${itemIndex + 1}-${typeIndex + 1}.${extension}`, {
              type: mimeType,
              lastModified: timestamp,
            })
          );
        }
      }

      if (files.length > 0) return dedupeFiles(files);
    }
  } catch {
    // Continue to text fallback.
  }

  try {
    if (typeof clipboard.readText === "function") {
      const text = await clipboard.readText();
      return dedupeFiles(filesFromClipboardText(text));
    }
  } catch {
    // Ignore and fall through.
  }

  return [];
}
