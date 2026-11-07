package app.hypermelo.core.playback

import app.hypermelo.core.model.Track
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackStateTest {

    @Test
    fun playbackSnapshot_calculatesCorrectProgressFraction() {
        val snapshot = PlaybackSnapshot(
            currentPositionMs = 30000L,
            durationMs = 120000L,
            status = PlaybackStatus.PLAYING
        )

        assertEquals(0.25f, snapshot.progressFraction, 0.001f)
        assertTrue(snapshot.isPlaying)
    }

    @Test
    fun playbackSnapshot_clampsProgressFractionBetweenZeroAndOne() {
        val snapshotOverflow = PlaybackSnapshot(
            currentPositionMs = 150000L,
            durationMs = 120000L
        )
        assertEquals(1.0f, snapshotOverflow.progressFraction, 0.001f)

        val snapshotZeroDuration = PlaybackSnapshot(
            currentPositionMs = 0L,
            durationMs = 0L
        )
        assertEquals(0.0f, snapshotZeroDuration.progressFraction, 0.001f)
    }

    @Test
    fun repeatMode_cyclesCorrectly() {
        var mode = RepeatMode.OFF
        mode = when (mode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        assertEquals(RepeatMode.ALL, mode)

        mode = when (mode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        assertEquals(RepeatMode.ONE, mode)

        mode = when (mode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        assertEquals(RepeatMode.OFF, mode)
    }
}

