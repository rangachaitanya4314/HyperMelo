package app.hypermelo.feature.player

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hypermelo.core.designsystem.HyperMeloColors
import app.hypermelo.core.designsystem.HyperMeloGlassCard
import app.hypermelo.core.model.Track
import app.hypermelo.core.playback.PlaybackSnapshot
import app.hypermelo.core.playback.RepeatMode
import coil.compose.AsyncImage

private fun formatTime(ms: Long): String {
    val totalSeconds = (ms / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return String.format("%02d:%02d", minutes, seconds)
}

@Composable
fun NowPlayingScreen(
    snapshot: PlaybackSnapshot,
    onPlayPause: () -> Unit = {},
    onPrevious: () -> Unit = {},
    onNext: () -> Unit = {},
    onSeek: (Long) -> Unit = {},
    onShuffle: () -> Unit = {},
    onRepeat: () -> Unit = {},
    onQueueSelect: (Int) -> Unit = {},
    onCollapse: () -> Unit = {},
    onLyricsClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val currentTrack = snapshot.currentTrack ?: Track(
        id = "np-fallback",
        title = "No Track Selected",
        artist = "HyperMelo",
        album = "Audiophile Catalog"
    )

    var isLiked by remember { mutableStateOf(false) }
    var isSeeking by remember { mutableStateOf(false) }
    var seekProgress by remember { mutableFloatStateOf(0f) }
    var isQueueOpen by remember { mutableStateOf(false) }

    val currentPositionMs = if (isSeeking) {
        (seekProgress * snapshot.durationMs).toLong()
    } else {
        snapshot.currentPositionMs
    }

    val sliderValue = if (isSeeking) {
        seekProgress
    } else {
        snapshot.progressFraction
    }

    val backgroundGradient = Brush.verticalGradient(
        colors = listOf(
            Color(0xFF1E1715),
            HyperMeloColors.MidnightSurface,
            HyperMeloColors.Obsidian
        )
    )

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(backgroundGradient)
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        val isCompactHeight = maxHeight < 650.dp
        val artworkFraction = if (isCompactHeight) 0.58f else 0.88f

        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onCollapse) {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Collapse",
                        tint = HyperMeloColors.TextPrimary,
                        modifier = Modifier.size(28.dp)
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "PLAYING FROM HYPERMELO",
                        color = HyperMeloColors.WarmPeach,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                    Text(
                        text = currentTrack.album.ifEmpty { "HyperMelo Master" },
                        color = HyperMeloColors.TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                IconButton(onClick = { /* Options */ }) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "Options",
                        tint = HyperMeloColors.TextPrimary
                    )
                }
            }

            // Error Banner (if any)
            if (snapshot.errorMessage != null) {
                HyperMeloGlassCard(
                    modifier = Modifier.fillMaxWidth(),
                    backgroundColor = Color(0x33EF4444),
                    borderColor = Color(0x66EF4444)
                ) {
                    Text(
                        text = snapshot.errorMessage,
                        color = HyperMeloColors.TextPrimary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(if (isCompactHeight) 4.dp else 8.dp))

            // 1:1 Album Artwork Canvas with Warm Peach Ambient Glow
            Box(
                modifier = Modifier
                    .fillMaxWidth(artworkFraction)
                    .aspectRatio(1f)
                    .shadow(
                        elevation = 24.dp,
                        shape = RoundedCornerShape(20.dp),
                        ambientColor = HyperMeloColors.WarmPeach,
                        spotColor = HyperMeloColors.PeachGlow
                    )
                    .clip(RoundedCornerShape(20.dp))
                    .background(HyperMeloColors.GlassSurface)
                    .border(1.dp, HyperMeloColors.GlassBorder, RoundedCornerShape(20.dp))
            ) {
                AsyncImage(
                    model = currentTrack.artworkUrl,
                    contentDescription = currentTrack.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                if (snapshot.isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0x66000000)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = HyperMeloColors.WarmPeach,
                            modifier = Modifier.size(40.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Track Metadata & Heart Button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = currentTrack.title,
                        color = HyperMeloColors.TextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = currentTrack.artist,
                            color = HyperMeloColors.SoftPeach,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (snapshot.isPreview) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(Color(0x33FBBF24))
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "30s PREVIEW",
                                    color = Color(0xFFFBBF24),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }

                IconButton(onClick = { isLiked = !isLiked }) {
                    Icon(
                        imageVector = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "Like",
                        tint = if (isLiked) HyperMeloColors.WarmPeach else HyperMeloColors.TextSecondary,
                        modifier = Modifier.size(26.dp)
                    )
                }
            }

            // Real-Time Scrubber / Slider
            Column(modifier = Modifier.fillMaxWidth()) {
                Slider(
                    value = sliderValue,
                    onValueChange = {
                        isSeeking = true
                        seekProgress = it
                    },
                    onValueChangeFinished = {
                        val targetMs = (seekProgress * snapshot.durationMs).toLong()
                        onSeek(targetMs)
                        isSeeking = false
                    },
                    colors = SliderDefaults.colors(
                        thumbColor = HyperMeloColors.WarmPeach,
                        activeTrackColor = HyperMeloColors.WarmPeach,
                        inactiveTrackColor = HyperMeloColors.GlassBorder
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = formatTime(currentPositionMs),
                        color = HyperMeloColors.TextMuted,
                        fontSize = 11.sp
                    )
                    Text(
                        text = formatTime(snapshot.durationMs),
                        color = HyperMeloColors.TextMuted,
                        fontSize = 11.sp
                    )
                }
            }

            // Primary Playback Transport Controls
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onShuffle) {
                    Icon(
                        imageVector = Icons.Default.Shuffle,
                        contentDescription = "Shuffle",
                        tint = if (snapshot.isShuffleEnabled) HyperMeloColors.WarmPeach else HyperMeloColors.TextSecondary,
                        modifier = Modifier.size(22.dp)
                    )
                }

                IconButton(onClick = onPrevious) {
                    Icon(
                        imageVector = Icons.Default.SkipPrevious,
                        contentDescription = "Previous",
                        tint = HyperMeloColors.TextPrimary,
                        modifier = Modifier.size(34.dp)
                    )
                }

                // Play / Pause Circle
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .clip(CircleShape)
                        .background(HyperMeloColors.WarmPeach)
                        .clickable { onPlayPause() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (snapshot.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (snapshot.isPlaying) "Pause" else "Play",
                        tint = HyperMeloColors.Obsidian,
                        modifier = Modifier.size(36.dp)
                    )
                }

                IconButton(onClick = onNext) {
                    Icon(
                        imageVector = Icons.Default.SkipNext,
                        contentDescription = "Next",
                        tint = HyperMeloColors.TextPrimary,
                        modifier = Modifier.size(34.dp)
                    )
                }

                IconButton(onClick = onRepeat) {
                    Icon(
                        imageVector = when (snapshot.repeatMode) {
                            RepeatMode.ONE -> Icons.Default.RepeatOne
                            else -> Icons.Default.Repeat
                        },
                        contentDescription = "Repeat",
                        tint = if (snapshot.repeatMode != RepeatMode.OFF) HyperMeloColors.WarmPeach else HyperMeloColors.TextSecondary,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }

            // Action Dock: Lyrics, Audio Engine, Queue
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Lyrics Pill
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(HyperMeloColors.GlassSurface)
                        .border(1.dp, HyperMeloColors.GlassBorder, RoundedCornerShape(20.dp))
                        .clickable { onLyricsClick() }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Subtitles,
                        contentDescription = "Lyrics",
                        tint = HyperMeloColors.WarmPeach,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "LYRICS",
                        color = HyperMeloColors.TextPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }

                // Audiophile Master indicator
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(HyperMeloColors.WarmPeach.copy(alpha = 0.15f))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.GraphicEq,
                        contentDescription = null,
                        tint = HyperMeloColors.WarmPeach,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (snapshot.isFullLength) "24-BIT / 96kHz" else "30s PREVIEW",
                        color = HyperMeloColors.WarmPeach,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Queue Button (Toggles queue view)
                IconButton(
                    onClick = { isQueueOpen = !isQueueOpen },
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(if (isQueueOpen) HyperMeloColors.WarmPeach else HyperMeloColors.GlassSurface)
                ) {
                    Icon(
                        imageVector = Icons.Default.QueueMusic,
                        contentDescription = "Queue",
                        tint = if (isQueueOpen) HyperMeloColors.Obsidian else HyperMeloColors.TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        // Overlay: Queue View
        AnimatedVisibility(
            visible = isQueueOpen,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(HyperMeloColors.Obsidian.copy(alpha = 0.95f))
                    .padding(20.dp)
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "PLAYBACK QUEUE",
                                color = HyperMeloColors.WarmPeach,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.5.sp
                            )
                            Text(
                                text = "${snapshot.queue.size} tracks in rotation",
                                color = HyperMeloColors.TextSecondary,
                                fontSize = 12.sp
                            )
                        }
                        IconButton(onClick = { isQueueOpen = false }) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = HyperMeloColors.TextPrimary)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        itemsIndexed(snapshot.queue) { idx, trk ->
                            val isCurrent = idx == snapshot.currentQueueIndex
                            HyperMeloGlassCard(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        onQueueSelect(idx)
                                        isQueueOpen = false
                                    },
                                backgroundColor = if (isCurrent) HyperMeloColors.WarmPeach.copy(alpha = 0.15f) else HyperMeloColors.GlassSurface,
                                borderColor = if (isCurrent) HyperMeloColors.WarmPeach else HyperMeloColors.GlassBorder
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "${idx + 1}",
                                        color = if (isCurrent) HyperMeloColors.WarmPeach else HyperMeloColors.TextMuted,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.width(24.dp)
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = trk.title,
                                            color = HyperMeloColors.TextPrimary,
                                            fontSize = 14.sp,
                                            fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium
                                        )
                                        Text(
                                            text = trk.artist,
                                            color = HyperMeloColors.TextSecondary,
                                            fontSize = 12.sp
                                        )
                                    }
                                    if (isCurrent) {
                                        Icon(
                                            imageVector = Icons.Default.GraphicEq,
                                            contentDescription = "Playing",
                                            tint = HyperMeloColors.WarmPeach,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
