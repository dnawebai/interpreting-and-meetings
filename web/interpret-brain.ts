// Portable agent contracts. Personal vocabulary is directional and explicitly approved.
export type Term = { source: string; target: string };
export type Evidence = { label: string; text: string; url?: string };

function words(value: string) {
  return value.normalize("NFKC").toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu)?.join(" ") || "";
}

export function encodeTerm(from: string, to: string, source: string, target: string) {
  return "Interpreter " + from + ">" + to + " " + JSON.stringify([source.trim(), target.trim()]);
}

export function recallTerms(memories: { content: string }[], from: string, to: string, original: string) {
  const prefix = "Interpreter " + from + ">" + to + " ";
  const haystack = " " + words(original) + " ";
  const result: Term[] = [];
  const seen = new Set<string>();
  for (const { content } of memories) {
    if (!content.startsWith(prefix)) continue;
    try {
      const pair: unknown = JSON.parse(content.slice(prefix.length));
      if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(x => typeof x === "string" && x.trim() && x.length <= 150)) continue;
      const key = words(pair[0]);
      if (!key || seen.has(key) || !haystack.includes(" " + key + " ")) continue;
      result.push({ source: pair[0], target: pair[1] });
      seen.add(key);
      if (result.length === 8) break;
    } catch { /* An edited note may no longer be a term. */ }
  }
  return result;
}

// Only attach evidence that the selected source actually contains. Line numbers refer to extracted text.
export function locateQuote(source: Evidence, quote: unknown) {
  if (typeof quote !== "string" || quote.trim().length < 4 || quote.length > 350) return null;
  const exact = quote.trim(), at = source.text.indexOf(exact);
  if (at < 0) return null;
  return { label: source.label, quote: exact, line: source.text.slice(0, at).split("\n").length, url: source.url };
}

export const fidelityPrompt = 'You are the bilingual fidelity reviewer. Check names, dates, quantities, negation, obligations, uncertain hearing and code-switching. In the reader language return {"question":""} if no concrete discrepancy, otherwise {"phrase":"exact substring of original","question":"one short question for the speaker"}. Never invent an error.';
export const researchPrompt = 'You are the terminology researcher. Compare the bilingual turn with the supplied sources. Identify a term meaning or a specific agreement/discrepancy actually evidenced by a source. Respond in the reader language. Return {"findings":[{"index":0,"quote":"short exact quotation from that source","note":"one cautious explanatory sentence"}]}. Return no findings when unsupported. Do not give legal advice.';

export function groundedFindings(result: unknown, sources: Evidence[]) {
  const raw = (result as { findings?: unknown } | null)?.findings;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0,4).flatMap(row => {
    if (!row || !Number.isInteger(row.index) || !sources[row.index] || typeof row.note !== "string") return [];
    const evidence = locateQuote(sources[row.index], row.quote), note = row.note.trim();
    return evidence && note && note.length <= 500 ? [{ ...evidence, note }] : [];
  });
}

export function reviewPhrase(result: unknown, original: string) {
  const row = result as { phrase?: unknown; question?: unknown } | null;
  if (!row || typeof row.phrase !== "string" || !row.phrase.trim() || row.phrase.length>150 || !original.includes(row.phrase) ||
      typeof row.question !== "string" || !row.question.trim() || row.question.length>400) return null;
  return { phrase: row.phrase, question: row.question.trim() };
}
