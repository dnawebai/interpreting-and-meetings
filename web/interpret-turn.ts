// Speech-to-text reports ISO 639-3. Preserve the spoken language independently of the UI locale.
const speechCodes: Record<string, string> = {
  eng: "en", fra: "fr", fre: "fr", por: "pt", spa: "es", ukr: "uk", deu: "de", ger: "de",
  ita: "it", ara: "ar", zho: "zh", cmn: "zh", chi: "zh", hin: "hi", rus: "ru", pol: "pl",
  tgl: "fil", vie: "vi", kor: "ko", jpn: "ja", fas: "fa", per: "fa", pan: "pa",
};

export function speechCode(raw: unknown): string {
  const code = typeof raw === "string" ? raw.trim().toLowerCase().split(/[-_]/)[0] : "";
  return speechCodes[code] ?? code;
}

/** A deliberate reply can be spoken in a third language without changing who receives it. */
export function routeInterpretation<T extends string>(home: T, partner: T | null, heard: T, reply: boolean) {
  if (reply || heard === home) return partner && partner !== heard ? { from: heard, to: partner, partner } : null;
  return { from: heard, to: home, partner: heard };
}

// Compare a single unambiguous written amount without treating a decimal comma as a difference.
function amount(line: string) {
  const numbers = [...line.matchAll(/[0-9]+(?:[., \u00a0\u202f][0-9]+)*/gu)];
  if (numbers.length !== 1) return null;
  const number = numbers[0], start = number.index!, end = start + number[0].length;
  const markers = line.matchAll(/(?<!\p{L})(?:USD|CAD|UAH|EUR|GBP|dollars?|долар(?:ів|и|а)?|грн|грив(?:ня|ні|ень|ню|ен)|hryvnias?|євро|euros?)(?!\p{L})|[$₴€£]/giu);
  for (const marker of markers) {
    const left = marker.index!, right = left + marker[0].length;
    if ((right <= start ? line.slice(right, start) : line.slice(end, left)).trim()) continue;
    const raw = number[0].replace(/[\u00a0\u202f]/g, " ");
    let decimal: string;
    if (/^\d+(?:[.,]\d{1,2})?$/.test(raw) || /^\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/.test(raw)) decimal = raw.replace(/ /g, "").replace(",", ".");
    else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(raw)) decimal = raw.replace(/,/g, "");
    else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(raw)) decimal = raw.replace(/\./g, "").replace(",", ".");
    else return null;
    const [whole, fraction = ""] = decimal.split(".");
    const label = marker[0].toLowerCase();
    const unit = /^(usd|cad|gbp)$/.test(label) ? label : label === "£" ? "gbp" : /^(€|eur|euro|euros|євро)$/.test(label) ? "eur" : /^(\$|dollar|долар)/.test(label) ? "dollar" : "uah";
    return { value: whole.replace(/^0+/, "") + "." + fraction.padEnd(2, "0"), unit, display: line.slice(Math.min(left, start), Math.max(right, end)) };
  }
  return null;
}

export function amountQuestion(original: string, translation: string) {
  const a = amount(original), b = amount(translation);
  if (!a || !b) return null;
  const compatible = a.unit === b.unit || (a.unit === "dollar" && ["cad", "usd"].includes(b.unit)) || (b.unit === "dollar" && ["cad", "usd"].includes(a.unit));
  return compatible && a.value === b.value ? null : a.display + " ↔ " + b.display;
}
