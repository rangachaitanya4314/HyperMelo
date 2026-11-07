package app.hypermelo.core.playback

import app.hypermelo.core.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PlaybackSourceResolverTest {

    private lateinit var resolver: PlaybackSourceResolver

    @Before
    fun setup() {
        resolver = PlaybackSourceResolver()
    }

    @Test
    fun resolveSource_withFullLengthMediaUrl_returnsSuccessAndFullLength() {
        val track = Track(
            id = "t1",
            title = "Full Track",
            artist = "Artist",
            durationSeconds = 240,
            mediaUrl = "https://example.com/audio.mp3",
            source = "verified"
        )

        val result = resolver.resolveSource(track)
        assertTrue(result is SourceResolutionResult.Success)
        val success = result as SourceResolutionResult.Success
        assertTrue(success.source.isFullLength)
        assertFalse(success.source.isPreview)
        assertEquals("https://example.com/audio.mp3", success.source.uri)
    }

    @Test
    fun resolveSource_withShortDurationPreview_distinguishesPreviewFromFullLength() {
        val previewTrack = Track(
            id = "t2",
            title = "Preview Track",
            artist = "Artist",
            durationSeconds = 30,
            mediaUrl = "https://example.com/stream_preview.mp3",
            source = "verified"
        )

        val result = resolver.resolveSource(previewTrack)
        assertTrue(result is SourceResolutionResult.Success)
        val success = result as SourceResolutionResult.Success
        assertFalse("Never represent a 30-second preview as full-length playback", success.source.isFullLength)
        assertTrue(success.source.isPreview)
    }

    @Test
    fun resolveSource_withNoMediaUrl_returnsErrorInsteadOfSynthesizingAudio() {
        val emptyTrack = Track(
            id = "t3",
            title = "Empty Source Track",
            artist = "Artist",
            durationSeconds = 200,
            mediaUrl = null,
            source = "unknown"
        )

        val result = resolver.resolveSource(emptyTrack)
        assertTrue("Never substitute unrelated synthetic audio when a source fails", result is SourceResolutionResult.Error)
    }

    @Test
    fun recordProviderFailure_enforcesCooldown() {
        resolver.recordProviderFailure("flaky_provider", cooldownDurationMs = 10000L)

        val track = Track(
            id = "t4",
            title = "Track with Cooled Provider",
            artist = "Artist",
            durationSeconds = 180,
            mediaUrl = "https://example.com/flaky.mp3",
            source = "flaky_provider"
        )

        val result = resolver.resolveSource(track)
        assertTrue(result is SourceResolutionResult.Error)
        val error = result as SourceResolutionResult.Error
        assertTrue(error.message.contains("cooling down"))
        assertTrue(error.isRecoverable)
    }
}

