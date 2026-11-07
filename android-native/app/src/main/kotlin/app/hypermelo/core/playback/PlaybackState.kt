package app.hypermelo.core.playback

import app.hypermelo.core.model.Track

enum class PlaybackStatus {
    IDLE,
    BUFFERING,
    READY,
    PLAYING,
    PAUSED,
    ENDED,
    ERROR
}

enum class RepeatMode {
    OFF,
    ALL,
    ONE
}

data class PlaybackSnapshot(
    val currentTrack: Track? = null,
    val status: PlaybackStatus = PlaybackStatus.IDLE,
    val currentPositionMs: Long = 0L,
    val durationMs: Long = 0L,
    val bufferedPositionMs: Long = 0L,
    val queue: List<Track> = emptyList(),
    val currentQueueIndex: Int = -1,
    val isShuffleEnabled: Boolean = false,
    val repeatMode: RepeatMode = RepeatMode.OFF,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isFullLength: Boolean = true,
    val isPreview: Boolean = false
) {
    val isPlaying: Boolean
        get() = status == PlaybackStatus.PLAYING

    val progressFraction: Float
        get() = if (durationMs > 0L) (currentPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f) else 0f
}

