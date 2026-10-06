/**
 * Tolerant JSON extraction.
 *
 * Local models are good but not perfect: they wrap JSON in code fences, add a
 * sentence before it, or leave a trailing comma. We try progressively harder
 * rather than throwing away an otherwise good mission.
 */

export function extractJson(raw: string): unknown {
  const text = raw.trim();
  if (!text) throw new Error("Empty response from model");

  const candidates: string[] = [text];

  // ```json ... ``` fences
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  // First {...} block
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  // Balanced-brace scan (handles trailing prose and stray braces in strings)
  const balanced = extractBalanced(text);
  if (balanced) candidates.push(balanced);

  for (const candidate of candidates) {
    for (const attempt of [candidate, stripTrailingCommas(candidate)]) {
      try {
        return JSON.parse(attempt);
      } catch {
        // try the next strategy
      }
    }
  }

  throw new Error("Model did not return parseable JSON");
}

function extractBalanced(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Removes commas before closing braces/brackets, a classic small-model slip. */
function stripTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, "$1");
}
