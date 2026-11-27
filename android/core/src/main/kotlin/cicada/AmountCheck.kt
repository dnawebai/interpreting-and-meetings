package cicada

/// A narrow local check before speech. Abstain on ranges, unmarked amounts and ambiguous grouping.
object AmountCheck {
    private val number = Regex("""\p{Nd}+(?:[., \u00a0\u202f]\p{Nd}+)*""")
    private val currency = Regex("""(?iu)(?<![\p{L}])(?:USD|CAD|UAH|EUR|GBP|dollars?|долар(?:ів|и|а)?|грн|грив(?:ня|ні|ень|ню|ен)|hryvnias?|євро|euros?)(?![\p{L}])|[$₴€£]""")
    private val plain = Regex("""[0-9]+(?:[.,][0-9]{1,2})?""")
    private val spaced = Regex("""[0-9]{1,3}(?: [0-9]{3})+(?:[.,][0-9]{1,2})?""")
    private val us = Regex("""[0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{1,2}""")
    private val eu = Regex("""[0-9]{1,3}(?:\.[0-9]{3})+,[0-9]{1,2}""")
    fun question(original: String, translation: String): String? {
        val first = amount(original) ?: return null
        val second = amount(translation) ?: return null
        val compatible = first.unit == second.unit ||
            (first.unit == "dollar" && second.unit in setOf("usd", "cad")) ||
            (second.unit == "dollar" && first.unit in setOf("usd", "cad"))
        return if (first.value == second.value && compatible) null else "${first.display} ↔ ${second.display}"
    }

    private data class Amount(val value: String, val unit: String, val display: String)

    private fun amount(line: String): Amount? {
        val digits = number.findAll(line).singleOrNull() ?: return null
        val marker = currency.findAll(line).firstOrNull { marker ->
            val gap = when {
                marker.range.last < digits.range.first -> line.substring(marker.range.last + 1, digits.range.first)
                digits.range.last < marker.range.first -> line.substring(digits.range.last + 1, marker.range.first)
                else -> return@firstOrNull false
            }
            gap.isBlank()
        } ?: return null
        val raw = digits.value.replace(' ', ' ').replace(' ', ' ')
        val normalized = when {
            plain.matches(raw) -> raw.replace(',', '.')
            spaced.matches(raw) -> raw.replace(" ", "").replace(',', '.')
            us.matches(raw) -> raw.replace(",", "")
            eu.matches(raw) -> raw.replace(".", "").replace(',', '.')
            else -> return null
        }
        val unit = when (val label = marker.value.lowercase()) {
            "usd", "cad", "gbp" -> label
            "£" -> "gbp"
            "€", "eur", "euro", "euros", "євро" -> "eur"
            "$", "dollar", "dollars", "долар", "долари", "долара", "доларів" -> "dollar"
            else -> "uah"
        }
        val display = line.substring(minOf(marker.range.first, digits.range.first), maxOf(marker.range.last, digits.range.last) + 1)
        return Amount(normalized.toBigDecimal().stripTrailingZeros().toPlainString(), unit, display)
    }
}
