package app.hypermelo.core.model

import kotlinx.serialization.Serializable

@Serializable
data class LyricWord(
    val text: String,
    val startMs: Long,
    val endMs: Long
)

@Serializable
enum class ScriptType {
    NATIVE,
    ROMANIZED
}

@Serializable
enum class KaraokeScriptMode {
    NATIVE,
    TRANSLITERATION
}

@Serializable
enum class LyricRepresentationType {
    ORIGINAL,
    TRANSLITERATION,
    TRANSLATION
}

@Serializable
data class VerifiedLyricRepresentation(
    val id: String,
    val type: LyricRepresentationType,
    val langCode: String,
    val label: String,
    val shortLabel: String,
    val isSinging: Boolean,
    val description: String
)

data class ListeningLyricDisplay(
    val originalText: String,
    val meaningText: String,
    val isMeaningAvailable: Boolean,
    val isSameAsOriginal: Boolean,
    val scriptType: ScriptType,
    val isNativeScriptAvailable: Boolean
)

@Serializable
data class TimedLyricLine(
    val id: String,
    val timeMs: Long,
    val durationMs: Long = 0,
    val endTimeMs: Long? = null,
    val text: String,
    val romanizedText: String? = null,
    val translationText: String? = null,
    val words: List<LyricWord>? = null,
    val isVerifiedWordTiming: Boolean = false,
    val originalLanguage: String = "en",
    val translations: Map<String, String> = emptyMap(),
    val pace: Float? = null
) {
    val effectiveEndTimeMs: Long
        get() = endTimeMs ?: (if (durationMs > 0) timeMs + durationMs else timeMs + 3500L)
}
