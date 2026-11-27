import Foundation

/// Mirrors the Android check. Only an explicit, unambiguous number beside a currency marker qualifies.
enum AmountCheck {
    private static let number = try! NSRegularExpression(pattern: #"\p{Nd}+(?:[., \u00a0\u202f]\p{Nd}+)*"#)
    private static let currency = try! NSRegularExpression(pattern: #"(?i)(?<![\p{L}])(?:USD|CAD|UAH|EUR|GBP|dollars?|долар(?:ів|и|а)?|грн|грив(?:ня|ні|ень|ню|ен)|hryvnias?|євро|euros?)(?![\p{L}])|[$₴€£]"#)
    private static let plain = try! NSRegularExpression(pattern: #"^(?:[0-9]+(?:[.,][0-9]{1,2})?)$"#)
    private static let spaced = try! NSRegularExpression(pattern: #"^(?:[0-9]{1,3}(?: [0-9]{3})+(?:[.,][0-9]{1,2})?)$"#)
    private static let us = try! NSRegularExpression(pattern: #"^(?:[0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{1,2})$"#)
    private static let eu = try! NSRegularExpression(pattern: #"^(?:[0-9]{1,3}(?:\.[0-9]{3})+,[0-9]{1,2})$"#)
    static func question(_ original: String, _ translation: String) -> String? {
        guard let first = amount(original), let second = amount(translation) else { return nil }
        let compatible = first.unit == second.unit ||
            (first.unit == "dollar" && ["usd", "cad"].contains(second.unit)) ||
            (second.unit == "dollar" && ["usd", "cad"].contains(first.unit))
        return first.value == second.value && compatible ? nil : "\(first.display) ↔ \(second.display)"
    }

    private static func amount(_ line: String) -> (value: String, unit: String, display: String)? {
        let text = line as NSString
        let range = NSRange(location: 0, length: text.length)
        let numbers = number.matches(in: line, range: range)
        guard numbers.count == 1, let digits = numbers.first?.range,
              let marker = currency.matches(in: line, range: range).first(where: { marker in
                  let r = marker.range
                  let start = min(NSMaxRange(r), NSMaxRange(digits))
                  let end = max(r.location, digits.location)
                  guard start <= end else { return false }
                  let gap = text.substring(with: NSRange(location: start, length: end - start))
                  return gap.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
              }) else { return nil }
        let raw = text.substring(with: digits).replacingOccurrences(of: " ", with: " ")
            .replacingOccurrences(of: " ", with: " ")
        let all = NSRange(location: 0, length: (raw as NSString).length)
        let compact: String
        if plain.firstMatch(in: raw, range: all) != nil || spaced.firstMatch(in: raw, range: all) != nil {
            compact = raw.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: ",", with: ".")
        } else if us.firstMatch(in: raw, range: all) != nil {
            compact = raw.replacingOccurrences(of: ",", with: "")
        } else if eu.firstMatch(in: raw, range: all) != nil {
            compact = raw.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
        } else { return nil }
        let parts = compact.components(separatedBy: ".")
        let whole = parts[0].drop(while: { $0 == "0" })
        let fraction = parts.count == 2 ? parts[1] : ""
        let label = text.substring(with: marker.range).lowercased()
        let unit: String
        switch label {
        case "usd", "cad", "gbp": unit = label
        case "£": unit = "gbp"
        case "€", "eur", "euro", "euros", "євро": unit = "eur"
        case "$", "dollar", "dollars", "долар", "долари", "долара", "доларів": unit = "dollar"
        default: unit = "uah"
        }
        let display = text.substring(with: NSUnionRange(digits, marker.range))
        return (String(whole) + "." + String((fraction + "00").prefix(2)), unit, display)
    }
}
