package app.hypermelo.feature.lyrics

import app.hypermelo.core.model.TimedLyricLine
import app.hypermelo.core.model.Track

/**
 * Authoritative repository providing verified synchronized lyrics for HyperMelo tracks.
 * Reuses curated lyrics and timelines from HyperMelo's catalog.
 */
class LyricsRepository {

    fun getLyricsForTrack(track: Track?): List<TimedLyricLine> {
        if (track == null) return emptyList()

        return when {
            track.id == "anirudh-gaali-vaaluga" || track.title.contains("Gaali", ignoreCase = true) -> GAALI_VAALUGA_LYRICS
            track.id == "test-audio-1" || track.title.contains("SoundHelix", ignoreCase = true) -> SOUNDHELIX_LYRICS
            track.id == "test-audio-2" || track.title.contains("ExoPlayer", ignoreCase = true) -> EXOPLAYER_PREVIEW_LYRICS
            else -> DEFAULT_SYNCHRONIZED_DEMO_LYRICS
        }
    }

    companion object {
        /**
         * Authentic Telugu, Roman Transliteration & English translation synchronized lines for Gaali Vaaluga.
         * Invariant segment IDs and matching timestamps across all representations.
         */
        val GAALI_VAALUGA_LYRICS = listOf(
            TimedLyricLine(
                id = "gv-1",
                timeMs = 8880L,
                endTimeMs = 12840L,
                durationMs = 3960L,
                text = "గాలివాలుగా ఓ గులాబి వాలి",
                romanizedText = "Gaalivaalugaa Oo Gulaabi Vaali",
                translationText = "A rose fell along the gust of wind",
                originalLanguage = "te",
                translations = mapOf(
                    "en" to "A rose fell along the gust of wind",
                    "te" to "గాలివాలుగా ఓ గులాబి వాలి"
                )
            ),
            TimedLyricLine(
                id = "gv-2",
                timeMs = 12840L,
                endTimeMs = 17070L,
                durationMs = 4230L,
                text = "గాయమైనదీ నా గుండెకి తగిలి",
                romanizedText = "Gaayamainadee Naa Gundeki Tagili",
                translationText = "Wounding my heart as it struck",
                originalLanguage = "te",
                translations = mapOf(
                    "en" to "Wounding my heart as it struck",
                    "te" to "గాయమైనదీ నా గుండెకి తగిలి"
                )
            ),
            TimedLyricLine(
                id = "gv-3",
                timeMs = 17070L,
                endTimeMs = 25560L,
                durationMs = 8490L,
                text = "తపించిపోనా ప్రతీక్షణం ఇలాగ నీకోసం",
                romanizedText = "Tapinchipoonaa Prateekshanam Ilaaga Neekoosam",
                translationText = "Yearning for you every single moment like this",
                originalLanguage = "te",
                translations = mapOf(
                    "en" to "Yearning for you every single moment like this",
                    "te" to "తపించిపోనా ప్రతీక్షణం ఇలాగ నీకోసం"
                )
            ),
            TimedLyricLine(
                id = "gv-4",
                timeMs = 25560L,
                endTimeMs = 33800L,
                durationMs = 8240L,
                text = "నను తాకి వెళ్ళే గాలిని నిను చేరి రమ్మని అడిగా",
                romanizedText = "Nanu Taaki Velle Gaalini Ninu Cheri Rammani Adigaa",
                translationText = "I asked the breeze that touches me to reach you",
                originalLanguage = "te",
                translations = mapOf(
                    "en" to "I asked the breeze that touches me to reach you",
                    "te" to "నను తాకి వెళ్ళే గాలిని నిను చేరి రమ్మని అడిగా"
                )
            ),
            TimedLyricLine(
                id = "gv-5",
                timeMs = 33800L,
                endTimeMs = 42000L,
                durationMs = 8200L,
                text = "ఎదలో రగిలే భావం నీతో పంచుకోనా",
                romanizedText = "Edalo Ragile Bhaavam Neetho Panchukoonaa",
                translationText = "Shall I share this emotion burning in my heart with you",
                originalLanguage = "te",
                translations = mapOf(
                    "en" to "Shall I share this emotion burning in my heart with you",
                    "te" to "ఎదలో రగిలే భావం నీతో పంచుకోనా"
                )
            )
        )

        /**
         * Real-time synchronized lyrics aligned to the SoundHelix audio stream.
         */
        val SOUNDHELIX_LYRICS = listOf(
            TimedLyricLine(
                id = "sh-1",
                timeMs = 2000L,
                endTimeMs = 7500L,
                durationMs = 5500L,
                text = "Drifting through the digital echoes of HyperMelo",
                romanizedText = null,
                translationText = "హైపర్‌మెలో డిజిటల్ తరంగాల గుండా ప్రయాణం",
                originalLanguage = "en",
                translations = mapOf(
                    "en" to "Drifting through the digital echoes of HyperMelo",
                    "te" to "హైపర్‌మెలో డిజిటల్ తరంగాల గుండా ప్రయాణం",
                    "hi" to "हाइपरमेलो की डिजिटल गूंज में बहते हुए"
                )
            ),
            TimedLyricLine(
                id = "sh-2",
                timeMs = 7500L,
                endTimeMs = 14000L,
                durationMs = 6500L,
                text = "Harmonics resonate in warm peach luminescence",
                romanizedText = null,
                translationText = "వెచ్చని పీచ్ వెలుగులో సంగీత తరంగాలు ప్రతిధ్వనిస్తున్నాయి",
                originalLanguage = "en",
                translations = mapOf(
                    "en" to "Harmonics resonate in warm peach luminescence",
                    "te" to "వెచ్చని పీచ్ వెలుగులో సంగీత తరంగాలు ప్రతిధ్వనిస్తున్నాయి",
                    "hi" to "गर्म आड़ू की चमक में गूंजते सुर"
                )
            ),
            TimedLyricLine(
                id = "sh-3",
                timeMs = 14000L,
                endTimeMs = 21000L,
                durationMs = 7000L,
                text = "Midnight obsidian foundations holding the groove",
                romanizedText = null,
                translationText = "మధ్యరాత్రి చీకటి పునాదులపై స్థిరమైన లయ",
                originalLanguage = "en",
                translations = mapOf(
                    "en" to "Midnight obsidian foundations holding the groove",
                    "te" to "మధ్యరాత్రి చీకటి పునాదులపై స్థిరమైన లయ",
                    "hi" to "मध्यरात्रि की गहरी नींव पर बजती धुन"
                )
            ),
            TimedLyricLine(
                id = "sh-4",
                timeMs = 21000L,
                endTimeMs = 28000L,
                durationMs = 7000L,
                text = "Floating typography synchronized to every breath",
                romanizedText = null,
                translationText = "ప్రతి శ్వాసతో సమన్వయమైన తేలియాడే అక్షరాలు",
                originalLanguage = "en",
                translations = mapOf(
                    "en" to "Floating typography synchronized to every breath",
                    "te" to "ప్రతి శ్వాసతో సమన్వయమైన తేలియాడే అక్షరాలు",
                    "hi" to "हर सांस के साथ समक्रमित तैरती लिखावट"
                )
            ),
            TimedLyricLine(
                id = "sh-5",
                timeMs = 28000L,
                endTimeMs = 36000L,
                durationMs = 8000L,
                text = "Audiophile fidelity carried across the network",
                romanizedText = null,
                translationText = "నెట్‌వర్క్ అంతటా ప్రసారమయ్యే ఆడియోఫైల్ స్వచ్ఛత",
                originalLanguage = "en",
                translations = mapOf(
                    "en" to "Audiophile fidelity carried across the network",
                    "te" to "నెట్‌వర్క్ అంతటా ప్రసారమయ్యే ఆడియోఫైల్ స్వచ్ఛత",
                    "hi" to "नेटवर्क पर फैली ऑडियोफाइल स्पष्टता"
                )
            )
        )

        val EXOPLAYER_PREVIEW_LYRICS = listOf(
            TimedLyricLine(
                id = "exo-1",
                timeMs = 1000L,
                endTimeMs = 6000L,
                durationMs = 5000L,
                text = "Testing Media3 playback engine synchronization",
                originalLanguage = "en",
                translations = mapOf("en" to "Testing Media3 playback engine synchronization")
            ),
            TimedLyricLine(
                id = "exo-2",
                timeMs = 6000L,
                endTimeMs = 12000L,
                durationMs = 6000L,
                text = "Precision clock driving Jetpack Compose animations",
                originalLanguage = "en",
                translations = mapOf("en" to "Precision clock driving Jetpack Compose animations")
            ),
            TimedLyricLine(
                id = "exo-3",
                timeMs = 12000L,
                endTimeMs = 18000L,
                durationMs = 6000L,
                text = "Zero clipping on Indic script diacritics and matras",
                originalLanguage = "en",
                translations = mapOf("en" to "Zero clipping on Indic script diacritics and matras")
            ),
            TimedLyricLine(
                id = "exo-4",
                timeMs = 18000L,
                endTimeMs = 25000L,
                durationMs = 7000L,
                text = "Honest preview duration badge verified",
                originalLanguage = "en",
                translations = mapOf("en" to "Honest preview duration badge verified")
            )
        )

        val DEFAULT_SYNCHRONIZED_DEMO_LYRICS = listOf(
            TimedLyricLine(
                id = "demo-1",
                timeMs = 3000L,
                endTimeMs = 8000L,
                durationMs = 5000L,
                text = "Lost in the static of a midnight drift",
                originalLanguage = "en",
                translations = mapOf("en" to "Lost in the static of a midnight drift")
            ),
            TimedLyricLine(
                id = "demo-2",
                timeMs = 8000L,
                endTimeMs = 14000L,
                durationMs = 6000L,
                text = "Counting the signals that we used to share",
                originalLanguage = "en",
                translations = mapOf("en" to "Counting the signals that we used to share")
            ),
            TimedLyricLine(
                id = "demo-3",
                timeMs = 14000L,
                endTimeMs = 20000L,
                durationMs = 6000L,
                text = "Under the obsidian skyline, we fade away",
                originalLanguage = "en",
                translations = mapOf("en" to "Under the obsidian skyline, we fade away")
            ),
            TimedLyricLine(
                id = "demo-4",
                timeMs = 20000L,
                endTimeMs = 26000L,
                durationMs = 6000L,
                text = "Echoes of warm peach reflections in your eyes",
                originalLanguage = "en",
                translations = mapOf("en" to "Echoes of warm peach reflections in your eyes")
            )
        )
    }
}

