package app.hypermelo.core.playback

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import app.hypermelo.core.model.Track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Authoritative central PlaybackManager for HyperMelo.
 * Owns the single ExoPlayer instance, tracks real playback timing,
 * and publishes a reactive StateFlow<PlaybackSnapshot>.
 */
@OptIn(UnstableApi::class)
class PlaybackManager(
    private val context: Context,
    private val sourceResolver: PlaybackSourceResolver = PlaybackSourceResolver()
) {
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var progressJob: Job? = null

    val exoPlayer: ExoPlayer by lazy {
        val audioAttributes = AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build()

        ExoPlayer.Builder(context)
            .setAudioAttributes(audioAttributes, /* handleAudioFocus= */ true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build().apply {
                addListener(playerListener)
            }
    }

    private val _snapshot = MutableStateFlow(PlaybackSnapshot())
    val snapshot: StateFlow<PlaybackSnapshot> = _snapshot.asStateFlow()

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            val status = when (playbackState) {
                Player.STATE_IDLE -> PlaybackStatus.IDLE
                Player.STATE_BUFFERING -> PlaybackStatus.BUFFERING
                Player.STATE_READY -> if (exoPlayer.isPlaying) PlaybackStatus.PLAYING else PlaybackStatus.PAUSED
                Player.STATE_ENDED -> PlaybackStatus.ENDED
                else -> PlaybackStatus.IDLE
            }

            val realDuration = exoPlayer.duration.takeIf { it > 0 } ?: 0L
            _snapshot.update { current ->
                current.copy(
                    status = status,
                    durationMs = realDuration,
                    bufferedPositionMs = exoPlayer.bufferedPosition.coerceAtLeast(0L),
                    isLoading = playbackState == Player.STATE_BUFFERING,
                    errorMessage = null
                )
            }

            if (playbackState == Player.STATE_READY && exoPlayer.isPlaying) {
                startProgressTracker()
            } else if (playbackState == Player.STATE_ENDED) {
                stopProgressTracker()
                handleTrackEnded()
            }
        }

        override fun onIsPlayingChanged(isPlaying: Boolean) {
            val newStatus = if (isPlaying) PlaybackStatus.PLAYING else PlaybackStatus.PAUSED
            _snapshot.update { it.copy(status = newStatus) }
            if (isPlaying) {
                startProgressTracker()
            } else {
                stopProgressTracker()
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            stopProgressTracker()
            val errorMsg = error.localizedMessage ?: "Playback error (${error.errorCodeName})"
            _snapshot.update { current ->
                current.copy(
                    status = PlaybackStatus.ERROR,
                    isLoading = false,
                    errorMessage = errorMsg
                )
            }
        }
    }

    private fun startProgressTracker() {
        ensureServiceRunning()
        progressJob?.cancel()
        progressJob = scope.launch {
            while (isActive && exoPlayer.isPlaying) {
                val pos = exoPlayer.currentPosition.coerceAtLeast(0L)
                val dur = exoPlayer.duration.takeIf { it > 0 } ?: _snapshot.value.durationMs
                val buf = exoPlayer.bufferedPosition.coerceAtLeast(0L)
                _snapshot.update { current ->
                    current.copy(
                        currentPositionMs = pos,
                        durationMs = dur,
                        bufferedPositionMs = buf
                    )
                }
                delay(200L)
            }
        }
    }

    private fun stopProgressTracker() {
        progressJob?.cancel()
        progressJob = null
    }

    private fun ensureServiceRunning() {
        try {
            val intent = android.content.Intent(context, HyperMeloPlaybackService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (_: Exception) {}
    }

    fun playTrack(track: Track, newQueue: List<Track>? = null) {
        val queue = newQueue ?: _snapshot.value.queue.ifEmpty { listOf(track) }
        val index = queue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
        setQueue(queue, index)
    }

    fun setQueue(tracks: List<Track>, startIndex: Int = 0) {
        if (tracks.isEmpty()) {
            exoPlayer.stop()
            exoPlayer.clearMediaItems()
            _snapshot.update {
                PlaybackSnapshot()
            }
            return
        }

        val clampedIndex = startIndex.coerceIn(0, tracks.lastIndex)
        val selectedTrack = tracks[clampedIndex]

        _snapshot.update { current ->
            current.copy(
                queue = tracks,
                currentQueueIndex = clampedIndex,
                currentTrack = selectedTrack,
                isLoading = true,
                errorMessage = null
            )
        }

        resolveAndPlay(selectedTrack)
    }

    private fun resolveAndPlay(track: Track) {
        when (val result = sourceResolver.resolveSource(track)) {
            is SourceResolutionResult.Success -> {
                val source = result.source
                val metadata = MediaMetadata.Builder()
                    .setTitle(track.title)
                    .setArtist(track.artist)
                    .setAlbumTitle(track.album)
                    .setArtworkUri(track.artworkUrl?.let { Uri.parse(it) })
                    .build()

                val mediaItem = MediaItem.Builder()
                    .setUri(source.uri)
                    .setMediaId(track.id)
                    .setMediaMetadata(metadata)
                    .build()

                _snapshot.update { current ->
                    current.copy(
                        isFullLength = source.isFullLength,
                        isPreview = source.isPreview,
                        isLoading = true
                    )
                }

                exoPlayer.setMediaItem(mediaItem)
                exoPlayer.prepare()
                exoPlayer.play()
            }
            is SourceResolutionResult.Error -> {
                _snapshot.update { current ->
                    current.copy(
                        status = PlaybackStatus.ERROR,
                        isLoading = false,
                        errorMessage = result.message
                    )
                }
            }
        }
    }

    fun togglePlayPause() {
        if (exoPlayer.isPlaying) {
            exoPlayer.pause()
        } else {
            if (exoPlayer.playbackState == Player.STATE_IDLE && _snapshot.value.currentTrack != null) {
                _snapshot.value.currentTrack?.let { resolveAndPlay(it) }
            } else {
                exoPlayer.play()
            }
        }
    }

    fun pause() {
        exoPlayer.pause()
    }

    fun resume() {
        exoPlayer.play()
    }

    fun seekTo(positionMs: Long) {
        val clamped = positionMs.coerceIn(0L, exoPlayer.duration.coerceAtLeast(0L))
        exoPlayer.seekTo(clamped)
        _snapshot.update { it.copy(currentPositionMs = clamped) }
    }

    fun skipToNext() {
        val state = _snapshot.value
        if (state.queue.isEmpty()) return

        val nextIndex = if (state.isShuffleEnabled) {
            state.queue.indices.random()
        } else {
            (state.currentQueueIndex + 1) % state.queue.size
        }

        selectQueueItem(nextIndex)
    }

    fun skipToPrevious() {
        val state = _snapshot.value
        if (state.queue.isEmpty()) return

        // If played more than 3 seconds, restart current track
        if (exoPlayer.currentPosition > 3000L) {
            seekTo(0L)
            return
        }

        val prevIndex = if (state.currentQueueIndex > 0) {
            state.currentQueueIndex - 1
        } else {
            state.queue.lastIndex
        }

        selectQueueItem(prevIndex)
    }

    fun selectQueueItem(index: Int) {
        val queue = _snapshot.value.queue
        if (index in queue.indices) {
            val track = queue[index]
            _snapshot.update {
                it.copy(currentQueueIndex = index, currentTrack = track)
            }
            resolveAndPlay(track)
        }
    }

    fun toggleShuffle() {
        _snapshot.update { current ->
            current.copy(isShuffleEnabled = !current.isShuffleEnabled)
        }
    }

    fun cycleRepeatMode() {
        val nextMode = when (_snapshot.value.repeatMode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        _snapshot.update { it.copy(repeatMode = nextMode) }
        exoPlayer.repeatMode = when (nextMode) {
            RepeatMode.OFF -> Player.REPEAT_MODE_OFF
            RepeatMode.ALL -> Player.REPEAT_MODE_ALL
            RepeatMode.ONE -> Player.REPEAT_MODE_ONE
        }
    }

    private fun handleTrackEnded() {
        when (_snapshot.value.repeatMode) {
            RepeatMode.ONE -> {
                seekTo(0L)
                exoPlayer.play()
            }
            RepeatMode.ALL -> skipToNext()
            RepeatMode.OFF -> {
                if (_snapshot.value.currentQueueIndex < _snapshot.value.queue.lastIndex) {
                    skipToNext()
                } else {
                    exoPlayer.pause()
                }
            }
        }
    }

    fun release() {
        stopProgressTracker()
        exoPlayer.removeListener(playerListener)
        exoPlayer.release()
    }

    companion object {
        @Volatile
        private var INSTANCE: PlaybackManager? = null

        fun getInstance(context: Context): PlaybackManager {
            return INSTANCE ?: synchronized(this) {
                val instance = PlaybackManager(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }
}

