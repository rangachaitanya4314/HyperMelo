package app.hypermelo.feature.lyrics

import app.hypermelo.core.model.LyricRepresentationType
import app.hypermelo.core.model.LyricWord
import app.hypermelo.core.model.ScriptType
import app.hypermelo.core.model.TimedLyricLine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LyricsSyncEngineTest {

    private val sampleLyrics = listOf(
        TimedLyricLine(
            id = "line-1",
            timeMs = 5000L,
            endTimeMs = 10000L,
            durationMs = 5000L,
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
            id = "line-2",
            timeMs = 10000L,
            endTimeMs = 15000L,
            durationMs = 5000L,
            text = "గాయమైనదీ నా గుండెకి తగిలి",
            romanizedText = "Gaayamainadee Naa Gundeki Tagili",
            translationText = "Wounding my heart as it struck",
            originalLanguage = "te",
            translations = mapOf(
                "en" to "Wounding my heart as it struck"
            )
        ),
        TimedLyricLine(
            id = "line-3",
            timeMs = 15000L,
            endTimeMs = 22000L,
            durationMs = 7000L,
            text = "తపించిపోనా ప్రతీక్షణం ఇలాగ నీకోసం",
            romanizedText = "Tapinchipoonaa Prateekshanam Ilaaga Neekoosam",
            translationText = "Yearning for you every single moment like this",
            originalLanguage = "te",
            translations = mapOf(
                "en" to "Yearning for you every single moment like this"
            )
        )
    )

    @Test
    fun testFindActiveIndexBeforeFirstLine() {
        val indexZero = LyricsSyncEngine.findActiveLyricIndex(sampleLyrics, 0L)
        val indexBefore = LyricsSyncEngine.findActiveLyricIndex(sampleLyrics, 4999L)
        assertEquals(-1, indexZero)
        assertEquals(-1, indexBefore)
    }

    @Test
    fun testFindActiveIndexDuringFirstLine() {
        val exactStart = LyricsSyncEngine.findActiveLyricIndex(sampleLyrics, 5000L)
        val midLine = LyricsSyncEngine.findActiveLyricIndex(sampleLyrics, 7500L)
        assertEquals(0, exactStart)
        assertEquals(0, midLine)
    }

    @Test
    fun testFindActiveIndexExactBoundaries() {
        val exactSecond = LyricsSyncEngine.findActiveLyricIndex(sampleLyrics, 10000L)
        val exactThird = LyricsSyncEngine.findActiveLyricIndex(sampleLyrics, 15000L)
        assertEquals(1, exactSecond)
        assertEquals(2, exactThird)
    }

    @Test
    fun testFindActiveIndexBetweenLines() {
        val indexBetween = LyricsSyncEngine.findActiveLyricIndex(sampleLyrics, 12500L)
        assertEquals(1, indexBetween)
    }

    @Test
    fun testFindActiveIndexAfterLastLine() {
        val indexAfter = LyricsSyncEngine.findActiveLyricIndex(sampleLyrics, 30000L)
        assertEquals(2, indexAfter)
    }

    @Test
    fun testFindActiveIndexEmptyList() {
        val index = LyricsSyncEngine.findActiveLyricIndex(emptyList(), 1000L)
        assertEquals(-1, index)
    }

    @Test
    fun testBinarySearchScaleWithLargeTimeline() {
        val largeList = (0 until 500).map { i ->
            TimedLyricLine(
                id = "line-$i",
                timeMs = i * 4000L,
                endTimeMs = (i + 1) * 4000L,
                durationMs = 4000L,
                text = "Line $i in large test sequence"
            )
        }

        assertEquals(0, LyricsSyncEngine.findActiveLyricIndex(largeList, 2000L))
        assertEquals(42, LyricsSyncEngine.findActiveLyricIndex(largeList, 42 * 4000L + 500L))
        assertEquals(250, LyricsSyncEngine.findActiveLyricIndex(largeList, 250 * 4000L))
        assertEquals(499, LyricsSyncEngine.findActiveLyricIndex(largeList, 499 * 4000L + 3999L))
        assertEquals(499, LyricsSyncEngine.findActiveLyricIndex(largeList, 500 * 4000L + 1000L))
    }

    @Test
    fun testIndicScriptDetection() {
        assertTrue(LyricsSyncEngine.isIndicScript("గాలివాలుగా"))
        assertTrue(LyricsSyncEngine.isIndicScript("नमस्ते दुनिया"))
        assertTrue(LyricsSyncEngine.isIndicScript("வணக்கம்"))
        assertTrue(LyricsSyncEngine.isIndicScript("ഹലോ ലോകം"))

        assertFalse(LyricsSyncEngine.isIndicScript("Hello world"))
        assertFalse(LyricsSyncEngine.isIndicScript("Gaalivaaluga"))
    }

    @Test
    fun testDetectLanguage() {
        assertEquals("te", LyricsSyncEngine.detectLanguage("గాలివాలుగా ఓ గులాబి వాలి"))
        assertEquals("hi", LyricsSyncEngine.detectLanguage("नमस्ते दुनिया"))
        assertEquals("ta", LyricsSyncEngine.detectLanguage("வணக்கம் நண்பா"))
        assertEquals("ml", LyricsSyncEngine.detectLanguage("നമസ്കാരം സുഹൃത്തേ"))
        assertEquals("en", LyricsSyncEngine.detectLanguage("Lost in the static"))
    }

    @Test
    fun testRomanizedVersusNativeScriptDistinction() {
        assertTrue(LyricsSyncEngine.isRomanized("Gaalivaalugaa", "te"))
        assertFalse(LyricsSyncEngine.isRomanized("గాలివాలుగా", "te"))
        assertFalse(LyricsSyncEngine.isRomanized("Hello world", "en"))

        // When original language is Telugu, Latin text is NOT valid native script
        assertFalse(
            LyricsSyncEngine.validateScriptForLanguage("Gaalivaalugaa", "te", originalLanguage = "te")
        )
        // Authentic Telugu script IS valid native script
        assertTrue(
            LyricsSyncEngine.validateScriptForLanguage("గాలివాలుగా", "te", originalLanguage = "te")
        )
    }

    @Test
    fun testScriptValidationStrictness() {
        // Telugu rejects Tamil, Devanagari, Malayalam
        assertTrue(LyricsSyncEngine.validateScriptForLanguage("ఓ గులాబి", "te"))
        assertFalse(LyricsSyncEngine.validateScriptForLanguage("வணக்கம்", "te"))
        assertFalse(LyricsSyncEngine.validateScriptForLanguage("नमस्ते", "te"))

        // Hindi rejects Telugu, Tamil, Malayalam
        assertTrue(LyricsSyncEngine.validateScriptForLanguage("नमस्ते", "hi"))
        assertFalse(LyricsSyncEngine.validateScriptForLanguage("గులాబి", "hi"))

        // Tamil rejects Telugu, Devanagari
        assertTrue(LyricsSyncEngine.validateScriptForLanguage("வணக்கம்", "ta"))
        assertFalse(LyricsSyncEngine.validateScriptForLanguage("గులాబి", "ta"))

        // English rejects Indic scripts
        assertTrue(LyricsSyncEngine.validateScriptForLanguage("Lost in the static", "en"))
        assertFalse(LyricsSyncEngine.validateScriptForLanguage("గులాబి", "en"))
    }

    @Test
    fun testHonestWordTimingEnforcement() {
        val lineWithUnverified = TimedLyricLine(
            id = "w1",
            timeMs = 1000L,
            text = "Testing whole line fallback",
            isVerifiedWordTiming = false,
            words = listOf(LyricWord("Testing", 1000L, 1500L))
        )
        // Must return null when isVerifiedWordTiming is false (whole-line animation fallback)
        assertNull(LyricsSyncEngine.getVerifiedWordTimings(lineWithUnverified))

        val lineWithVerified = TimedLyricLine(
            id = "w2",
            timeMs = 1000L,
            text = "Testing verified words",
            isVerifiedWordTiming = true,
            words = listOf(
                LyricWord("Testing", 1000L, 1500L),
                LyricWord("verified", 1500L, 2000L)
            )
        )
        val words = LyricsSyncEngine.getVerifiedWordTimings(lineWithVerified)
        assertNotNull(words)
        assertEquals(2, words?.size)
    }

    @Test
    fun testTranslationStaggerContract() {
        assertEquals(40L, LyricsSyncEngine.TRANSLATION_STAGGER_MS)
    }

    @Test
    fun testGetAvailableRepresentationsHonesty() {
        val reps = LyricsSyncEngine.getAvailableRepresentations(sampleLyrics, "te")

        // Must offer Original Telugu
        assertTrue(reps.any { it.type == LyricRepresentationType.ORIGINAL && it.langCode == "te" })

        // Must offer Roman Transliteration
        assertTrue(reps.any { it.type == LyricRepresentationType.TRANSLITERATION })

        // Must offer English Meaning (since translations["en"] exists)
        assertTrue(reps.any { it.type == LyricRepresentationType.TRANSLATION && it.langCode == "en" })

        // Must NOT offer fake/unverified languages like Tamil or Malayalam for this song
        assertFalse(reps.any { it.type == LyricRepresentationType.TRANSLATION && it.langCode == "ta" })
        assertFalse(reps.any { it.type == LyricRepresentationType.TRANSLATION && it.langCode == "ml" })
    }

    @Test
    fun testListeningLyricDisplayResolution() {
        val line = sampleLyrics[0]

        // English translation requested for Telugu song
        val displayEn = LyricsSyncEngine.getListeningLyricDisplay(line, "en", "te")
        assertEquals("గాలివాలుగా ఓ గులాబి వాలి", displayEn.originalText)
        assertEquals("A rose fell along the gust of wind", displayEn.meaningText)
        assertTrue(displayEn.isMeaningAvailable)
        assertFalse(displayEn.isSameAsOriginal)
        assertEquals(ScriptType.NATIVE, displayEn.scriptType)
        assertTrue(displayEn.isNativeScriptAvailable)

        // Unavailable translation requested (e.g. Hindi)
        val displayHi = LyricsSyncEngine.getListeningLyricDisplay(line, "hi", "te")
        assertEquals("Meaning unavailable in Hindi", displayHi.meaningText)
        assertFalse(displayHi.isMeaningAvailable)
    }
}

