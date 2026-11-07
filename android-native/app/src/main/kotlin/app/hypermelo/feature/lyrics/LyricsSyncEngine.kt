package app.hypermelo.feature.lyrics

import app.hypermelo.core.model.KaraokeScriptMode
import app.hypermelo.core.model.ListeningLyricDisplay
import app.hypermelo.core.model.LyricRepresentationType
import app.hypermelo.core.model.LyricWord
import app.hypermelo.core.model.ScriptType
import app.hypermelo.core.model.TimedLyricLine
import app.hypermelo.core.model.VerifiedLyricRepresentation

/**
 * Authoritative lyrics synchronization and linguistic validation engine for HyperMelo.
 * Ported faithfully from HyperMelo canonical contracts (src/shared/lyrics.ts & src/services/lyrics/lyricsSync.ts).
 *
 * Guarantees:
 * - O(log N) binary-search active lyric lookup.
 * - Honest script validation across Telugu, Devanagari (Hindi), Tamil, Malayalam, and English.
 * - Strict separation of native script vs Romanized transliteration.
 * - Never fabricates synthetic word-level timings (whole-line fallback when unverified).
 * - 40ms maximum translation stagger synchronization contract.
 */
object LyricsSyncEngine {

    val TRANSLATION_STAGGER_MS: Long = 40L

    private val TELUGU_REGEX = Regex("[\\u0C00-\\u0C7F]")
    private val TAMIL_REGEX = Regex("[\\u0B80-\\u0BFF]")
    private val DEVANAGARI_REGEX = Regex("[\\u0900-\\u097F]")
    private val MALAYALAM_REGEX = Regex("[\\u0D00-\\u0D7F]")
    private val GURMUKHI_REGEX = Regex("[\\u0A00-\\u0A7F]")
    private val INDIC_REGEX = Regex("[\\u0900-\\u0D7F]")
    private val LATIN_REGEX = Regex("[a-zA-Z]")

    private val LANGUAGE_NAMES = mapOf(
        "en" to "English",
        "hi" to "Hindi",
        "te" to "Telugu",
        "ta" to "Tamil",
        "ml" to "Malayalam",
        "pa" to "Punjabi"
    )

    private val NATIVE_LABELS = mapOf(
        "en" to "English",
        "hi" to "हिन्दी",
        "te" to "తెలుగు",
        "ta" to "தமிழ்",
        "ml" to "മലയാളം",
        "pa" to "ਪੰਜਾਬੀ"
    )

    /**
     * Binary search to determine the active lyric line index for a given playback position in milliseconds.
     * Returns:
     * - -1 if lyrics list is empty or playback position is before the first lyric line.
     * - The 0-based index of the active lyric line.
     */
    fun findActiveLyricIndex(lyrics: List<TimedLyricLine>, positionMs: Long): Int {
        if (lyrics.isEmpty()) return -1
        if (positionMs < lyrics[0].timeMs) return -1

        var low = 0
        var high = lyrics.lastIndex
        var candidate = -1

        while (low <= high) {
            val mid = (low + high) ushr 1
            val line = lyrics[mid]
            if (line.timeMs <= positionMs) {
                candidate = mid
                low = mid + 1
            } else {
                high = mid - 1
            }
        }

        return candidate
    }

    /**
     * Checks if the text contains any Indic Brahmic script characters.
     */
    fun isIndicScript(text: String): Boolean {
        if (text.isBlank()) return false
        return INDIC_REGEX.containsMatchIn(text)
    }

    /**
     * Checks if text is in Latin alphabet without Indic characters.
     */
    fun isLatinScript(text: String): Boolean {
        if (text.isBlank()) return false
        return LATIN_REGEX.containsMatchIn(text) && !isIndicScript(text)
    }

    /**
     * Determines whether the given text is Romanized transliteration for an Indic language.
     */
    fun isRomanized(text: String, originalLanguage: String): Boolean {
        if (text.isBlank()) return false
        val normalizedLang = originalLanguage.lowercase().trim()
        val indicLangs = setOf("te", "hi", "ta", "ml", "pa", "kn", "bn")
        return isLatinScript(text) && indicLangs.contains(normalizedLang)
    }

    /**
     * Detects primary language from script characters.
     */
    fun detectLanguage(text: String): String {
        if (text.isBlank()) return "en"
        return when {
            TELUGU_REGEX.containsMatchIn(text) -> "te"
            TAMIL_REGEX.containsMatchIn(text) -> "ta"
            MALAYALAM_REGEX.containsMatchIn(text) -> "ml"
            DEVANAGARI_REGEX.containsMatchIn(text) -> "hi"
            GURMUKHI_REGEX.containsMatchIn(text) -> "pa"
            else -> "en"
        }
    }

    /**
     * Validates whether the text conforms to the script required by targetLanguage.
     * Strict rules:
     * - te: Must contain Telugu script and NOT contain Tamil, Devanagari, or Malayalam.
     * - ta: Must contain Tamil script and NOT contain Telugu, Devanagari, or Malayalam.
     * - hi: Must contain Devanagari script and NOT contain Telugu, Tamil, or Malayalam.
     * - ml: Must contain Malayalam script and NOT contain Telugu, Tamil, or Devanagari.
     * - en: Must contain Latin text and NOT contain Indic scripts.
     */
    fun validateScriptForLanguage(
        text: String,
        targetLanguage: String,
        originalLanguage: String? = null
    ): Boolean {
        if (text.isBlank()) return false

        val hasTamil = TAMIL_REGEX.containsMatchIn(text)
        val hasTelugu = TELUGU_REGEX.containsMatchIn(text)
        val hasDevanagari = DEVANAGARI_REGEX.containsMatchIn(text)
        val hasMalayalam = MALAYALAM_REGEX.containsMatchIn(text)
        val hasGurmukhi = GURMUKHI_REGEX.containsMatchIn(text)
        val hasAnyIndic = hasTamil || hasTelugu || hasDevanagari || hasMalayalam || hasGurmukhi
        val hasLatinLetters = LATIN_REGEX.containsMatchIn(text)

        // Non-lexical markers e.g. (Music), [Instrumental], digits
        val trimmed = text.trim()
        if ((trimmed.startsWith("(") && trimmed.endsWith(")")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            return true
        }

        // If target language is the same as the original song's language:
        // For Indic targets, Romanized Latin without native script is NOT valid native script
        if (originalLanguage != null && targetLanguage == originalLanguage) {
            if (setOf("te", "ta", "hi", "ml", "pa").contains(targetLanguage)) {
                if (!hasAnyIndic && hasLatinLetters) {
                    return false
                }
            }
            return true
        }

        return when (targetLanguage) {
            "te" -> !hasTamil && !hasDevanagari && !hasMalayalam && !hasGurmukhi && hasTelugu
            "ta" -> !hasTelugu && !hasDevanagari && !hasMalayalam && !hasGurmukhi && hasTamil
            "hi" -> !hasTelugu && !hasTamil && !hasMalayalam && !hasGurmukhi && hasDevanagari
            "ml" -> !hasTelugu && !hasTamil && !hasDevanagari && !hasGurmukhi && hasMalayalam
            "en" -> !hasAnyIndic && hasLatinLetters
            else -> true
        }
    }

    /**
     * Resolves listening display model (original text + contextual meaning / translation)
     * with honest native script and transliteration reporting.
     */
    fun getListeningLyricDisplay(
        line: TimedLyricLine?,
        targetLanguage: String = "en",
        songOriginalLanguage: String? = null
    ): ListeningLyricDisplay {
        if (line == null) {
            return ListeningLyricDisplay(
                originalText = "",
                meaningText = "",
                isMeaningAvailable = false,
                isSameAsOriginal = false,
                scriptType = ScriptType.ROMANIZED,
                isNativeScriptAvailable = false
            )
        }

        val originalText = line.text.trim()
        val effectiveOriginalLang = line.originalLanguage.ifBlank {
            songOriginalLanguage ?: detectLanguage(originalText)
        }

        val isTargetIndic = setOf("te", "ta", "hi", "ml", "pa").contains(targetLanguage)
        val langName = LANGUAGE_NAMES[targetLanguage] ?: targetLanguage.uppercase()

        // Case A: User selected same Indic language as original song
        if (targetLanguage == effectiveOriginalLang && isTargetIndic) {
            val isNativeValid = validateScriptForLanguage(originalText, targetLanguage, effectiveOriginalLang)
            return if (isNativeValid) {
                ListeningLyricDisplay(
                    originalText = originalText,
                    meaningText = line.translationText ?: originalText,
                    isMeaningAvailable = true,
                    isSameAsOriginal = true,
                    scriptType = ScriptType.NATIVE,
                    isNativeScriptAvailable = true
                )
            } else {
                val romanized = line.romanizedText ?: originalText
                ListeningLyricDisplay(
                    originalText = romanized,
                    meaningText = "$langName script unavailable",
                    isMeaningAvailable = false,
                    isSameAsOriginal = false,
                    scriptType = ScriptType.ROMANIZED,
                    isNativeScriptAvailable = false
                )
            }
        }

        // Case B: User selected Indic translation differing from song's original language
        if (isTargetIndic && targetLanguage != effectiveOriginalLang) {
            val isOriginalIndic = setOf("te", "ta", "hi", "ml", "pa").contains(effectiveOriginalLang)
            val isOriginalNative = isOriginalIndic && validateScriptForLanguage(originalText, effectiveOriginalLang, effectiveOriginalLang)
            val scriptType = if (isOriginalNative) ScriptType.NATIVE else ScriptType.ROMANIZED

            val translationCandidate = line.translations[targetLanguage]?.trim()
                ?: line.translationText?.takeIf { targetLanguage == "en" }?.trim()

            val hasValidTargetScript = translationCandidate != null &&
                validateScriptForLanguage(translationCandidate, targetLanguage, effectiveOriginalLang)

            return if (hasValidTargetScript && !translationCandidate.isNullOrBlank()) {
                ListeningLyricDisplay(
                    originalText = originalText,
                    meaningText = translationCandidate,
                    isMeaningAvailable = true,
                    isSameAsOriginal = false,
                    scriptType = scriptType,
                    isNativeScriptAvailable = isOriginalNative
                )
            } else {
                ListeningLyricDisplay(
                    originalText = originalText,
                    meaningText = "Meaning unavailable in $langName",
                    isMeaningAvailable = false,
                    isSameAsOriginal = false,
                    scriptType = scriptType,
                    isNativeScriptAvailable = isOriginalNative
                )
            }
        }

        // Case C: Target is English ('en')
        val isSameAsOriginal = effectiveOriginalLang == "en"
        val isOriginalIndic = setOf("te", "ta", "hi", "ml", "pa").contains(effectiveOriginalLang)
        val isOriginalNative = isOriginalIndic && validateScriptForLanguage(originalText, effectiveOriginalLang, effectiveOriginalLang)
        val scriptType = if (isOriginalNative) ScriptType.NATIVE else ScriptType.ROMANIZED

        val englishMeaning = line.translations["en"]?.trim() ?: line.translationText?.trim()

        if (!englishMeaning.isNullOrBlank()) {
            return ListeningLyricDisplay(
                originalText = originalText,
                meaningText = englishMeaning,
                isMeaningAvailable = true,
                isSameAsOriginal = isSameAsOriginal,
                scriptType = scriptType,
                isNativeScriptAvailable = isOriginalNative
            )
        }

        if (isSameAsOriginal) {
            return ListeningLyricDisplay(
                originalText = originalText,
                meaningText = originalText,
                isMeaningAvailable = true,
                isSameAsOriginal = true,
                scriptType = ScriptType.NATIVE,
                isNativeScriptAvailable = true
            )
        }

        return ListeningLyricDisplay(
            originalText = originalText,
            meaningText = "Meaning unavailable in English",
            isMeaningAvailable = false,
            isSameAsOriginal = false,
            scriptType = scriptType,
            isNativeScriptAvailable = isOriginalNative
        )
    }

    /**
     * Resolves available lyric representation options for a track.
     * Guarantees:
     * - Only offers translations if genuine data exists.
     * - Offers Roman transliteration only if original is non-Latin and transliteration exists.
     */
    fun getAvailableRepresentations(
        lines: List<TimedLyricLine>,
        songOriginalLanguage: String? = null
    ): List<VerifiedLyricRepresentation> {
        if (lines.isEmpty()) return emptyList()

        val firstLine = lines.first()
        val originalLang = firstLine.originalLanguage.ifBlank {
            songOriginalLanguage ?: detectLanguage(firstLine.text)
        }
        val langName = LANGUAGE_NAMES[originalLang] ?: originalLang.uppercase()
        val nativeLabel = NATIVE_LABELS[originalLang] ?: langName

        val reps = mutableListOf<VerifiedLyricRepresentation>()

        // 1. Original Native Script
        reps.add(
            VerifiedLyricRepresentation(
                id = "original",
                type = LyricRepresentationType.ORIGINAL,
                langCode = originalLang,
                label = if (originalLang == "en") "Original (English)" else "Original ($nativeLabel)",
                shortLabel = if (originalLang == "en") "EN" else nativeLabel,
                isSinging = true,
                description = "Original sung lyrics in $langName ($nativeLabel)"
            )
        )

        // 2. Roman Transliteration (if original is non-Latin and transliteration exists)
        val hasTransliteration = lines.any { !it.romanizedText.isNullOrBlank() }
        if (!isLatinScript(firstLine.text) && hasTransliteration) {
            reps.add(
                VerifiedLyricRepresentation(
                    id = "transliteration",
                    type = LyricRepresentationType.TRANSLITERATION,
                    langCode = originalLang,
                    label = "Roman Transliteration",
                    shortLabel = "Roman Script",
                    isSinging = true,
                    description = "Phonetic Roman alphabet singing guide"
                )
            )
        }

        // 3. Verified Translations
        val candidateTargets = listOf("en", "hi", "te", "ta", "ml")
        for (target in candidateTargets) {
            if (target == originalLang) continue
            val hasVerifiedTranslation = lines.any { line ->
                val tr = line.translations[target]?.trim()
                    ?: (if (target == "en") line.translationText?.trim() else null)
                tr != null && tr.isNotBlank() && validateScriptForLanguage(tr, target, originalLang)
            }

            if (hasVerifiedTranslation) {
                val tName = LANGUAGE_NAMES[target] ?: target.uppercase()
                val tNative = NATIVE_LABELS[target] ?: tName
                reps.add(
                    VerifiedLyricRepresentation(
                        id = "translation-$target",
                        type = LyricRepresentationType.TRANSLATION,
                        langCode = target,
                        label = "$tName Meaning",
                        shortLabel = if (target == "en") "EN Meaning" else "$tNative (Meaning)",
                        isSinging = false,
                        description = "Verified $tName ($tNative) translation for understanding"
                    )
                )
            }
        }

        return reps
    }

    /**
     * Enforces verified word timings vs whole-line animation fallback.
     * Returns words only if isVerifiedWordTiming is explicitly true and list is non-empty.
     */
    fun getVerifiedWordTimings(line: TimedLyricLine): List<LyricWord>? {
        return if (line.isVerifiedWordTiming && !line.words.isNullOrEmpty()) {
            line.words
        } else {
            null
        }
    }
}
