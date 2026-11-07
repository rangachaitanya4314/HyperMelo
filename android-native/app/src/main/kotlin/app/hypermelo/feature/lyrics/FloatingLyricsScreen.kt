package app.hypermelo.feature.lyrics

import android.content.Context
import android.provider.Settings
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hypermelo.core.designsystem.HyperMeloColors
import app.hypermelo.core.model.LyricRepresentationType
import app.hypermelo.core.model.ScriptType
import app.hypermelo.core.model.TimedLyricLine
import app.hypermelo.core.model.Track
import app.hypermelo.core.playback.PlaybackSnapshot

private fun checkReducedMotion(context: Context): Boolean {
    return try {
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1.0f
        ) == 0f
    } catch (_: Exception) {
        false
    }
}

/**
 * Premium Floating Lyrics presentation for HyperMelo Android.
 * Synchronized to the Media3 playback clock, featuring:
 * - O(log N) binary search active lyric resolution.
 * - Active line scale 1.035f with warm peach accent (#E7A58D).
 * - Ascending past lines and emerging impending lines depth stages.
 * - 40ms staggered translation/meaning subtitles.
 * - Generous line heights to prevent Indic diacritic / vowel mark clipping.
 * - Reduced motion accessibility support.
 * - Direct seeking by tapping any line.
 */
@Composable
fun FloatingLyricsScreen(
    snapshot: PlaybackSnapshot,
    onSeek: (Long) -> Unit = {},
    onPlayPause: () -> Unit = {},
    onDismiss: () -> Unit = {},
    lyricsRepository: LyricsRepository = remember { LyricsRepository() },
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val isReducedMotion = remember { checkReducedMotion(context) }

    val currentTrack = snapshot.currentTrack ?: Track(
        id = "demo",
        title = "HyperMelo Session",
        artist = "Audiophile Sound Engine"
    )

    val lyrics = remember(currentTrack.id) {
        lyricsRepository.getLyricsForTrack(currentTrack)
    }

    val representations = remember(lyrics, currentTrack.language) {
        LyricsSyncEngine.getAvailableRepresentations(lyrics, currentTrack.language)
    }

    var selectedRepresentationId by remember(currentTrack.id) {
        mutableStateOf(representations.firstOrNull()?.id ?: "original")
    }

    var isLanguageMenuOpen by remember { mutableStateOf(false) }

    val activeLineIndex by remember(lyrics, snapshot.currentPositionMs) {
        derivedStateOf {
            LyricsSyncEngine.findActiveLyricIndex(lyrics, snapshot.currentPositionMs)
        }
    }

    val listState = rememberLazyListState()

    // Smooth scroll centering on active line
    LaunchedEffect(activeLineIndex) {
        if (activeLineIndex in lyrics.indices) {
            try {
                listState.animateScrollToItem(
                    index = activeLineIndex,
                    scrollOffset = -220
                )
            } catch (_: Exception) {}
        }
    }

    val selectedRep = representations.find { it.id == selectedRepresentationId }
        ?: representations.firstOrNull()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(HyperMeloColors.Obsidian)
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        // Top Navigation & Control Bar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "FLOATING LYRICS",
                    color = HyperMeloColors.WarmPeach,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp
                )
                Text(
                    text = "${currentTrack.title} • ${currentTrack.artist}",
                    color = HyperMeloColors.TextSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                // Play / Pause Mini Toggle
                IconButton(
                    onClick = onPlayPause,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(HyperMeloColors.GlassSurface)
                ) {
                    Icon(
                        imageVector = if (snapshot.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (snapshot.isPlaying) "Pause" else "Play",
                        tint = HyperMeloColors.WarmPeach,
                        modifier = Modifier.size(18.dp)
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Language / Script Selector Button
                Box {
                    IconButton(
                        onClick = { isLanguageMenuOpen = true },
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(HyperMeloColors.GlassSurface)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Translate,
                            contentDescription = "Script and Translations",
                            tint = HyperMeloColors.WarmPeach,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    DropdownMenu(
                        expanded = isLanguageMenuOpen,
                        onDismissRequest = { isLanguageMenuOpen = false },
                        modifier = Modifier.background(HyperMeloColors.MidnightSurface)
                    ) {
                        representations.forEach { rep ->
                            val isSelected = rep.id == selectedRepresentationId
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(
                                            text = rep.label,
                                            color = if (isSelected) HyperMeloColors.WarmPeach else HyperMeloColors.TextPrimary,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                            fontSize = 14.sp
                                        )
                                        Text(
                                            text = rep.description,
                                            color = HyperMeloColors.TextMuted,
                                            fontSize = 11.sp
                                        )
                                    }
                                },
                                onClick = {
                                    selectedRepresentationId = rep.id
                                    isLanguageMenuOpen = false
                                },
                                colors = MenuDefaults.itemColors()
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Close Button
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(HyperMeloColors.GlassSurface)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = HyperMeloColors.TextPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // Active Language Pill Indicator
        selectedRep?.let { rep ->
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(HyperMeloColors.GlassSurface)
                    .border(1.dp, HyperMeloColors.GlassBorder, RoundedCornerShape(12.dp))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(HyperMeloColors.WarmPeach)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = rep.label.uppercase(),
                    color = HyperMeloColors.WarmPeach,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Floating Lyrics Stream
        if (lyrics.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No synchronized lyrics available for this track",
                    color = HyperMeloColors.TextMuted,
                    fontSize = 14.sp
                )
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(top = 80.dp, bottom = 220.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                itemsIndexed(lyrics, key = { _, item -> item.id }) { index, line ->
                    val isActive = index == activeLineIndex
                    val isPast = activeLineIndex != -1 && index < activeLineIndex
                    val isFuture = activeLineIndex != -1 && index > activeLineIndex

                    // Animated Visual Properties
                    val targetScale = when {
                        isReducedMotion -> 1.0f
                        isActive -> 1.035f
                        isPast -> 0.98f
                        else -> 0.98f
                    }

                    val targetAlpha = when {
                        isActive -> 1.0f
                        isPast -> 0.40f
                        else -> 0.45f
                    }

                    val targetOffsetY = when {
                        isReducedMotion -> 0f
                        isActive -> 0f
                        isPast -> -6f
                        else -> 6f
                    }

                    val scale by animateFloatAsState(
                        targetValue = targetScale,
                        animationSpec = tween(
                            durationMillis = if (isReducedMotion) 0 else 320,
                            easing = FastOutSlowInEasing
                        ),
                        label = "LyricScale"
                    )

                    val alpha by animateFloatAsState(
                        targetValue = targetAlpha,
                        animationSpec = tween(
                            durationMillis = if (isReducedMotion) 120 else 320,
                            easing = LinearEasing
                        ),
                        label = "LyricAlpha"
                    )

                    val offsetY by animateFloatAsState(
                        targetValue = targetOffsetY,
                        animationSpec = tween(
                            durationMillis = if (isReducedMotion) 0 else 320,
                            easing = FastOutSlowInEasing
                        ),
                        label = "LyricOffsetY"
                    )

                    // Staggered translation animation (40ms delayed)
                    val translationAlpha by animateFloatAsState(
                        targetValue = if (isActive) 0.95f else 0.40f,
                        animationSpec = tween(
                            durationMillis = if (isReducedMotion) 120 else 360,
                            delayMillis = if (isReducedMotion) 0 else LyricsSyncEngine.TRANSLATION_STAGGER_MS.toInt(),
                            easing = FastOutSlowInEasing
                        ),
                        label = "TranslationAlpha"
                    )

                    // Resolve lyric text according to selected representation
                    val displayText: String
                    val secondaryText: String?

                    when (selectedRep?.type) {
                        LyricRepresentationType.TRANSLITERATION -> {
                            displayText = line.romanizedText ?: line.text
                            secondaryText = if (isActive) line.text else null
                        }
                        LyricRepresentationType.TRANSLATION -> {
                            val targetLang = selectedRep.langCode
                            val display = LyricsSyncEngine.getListeningLyricDisplay(line, targetLang, currentTrack.language)
                            displayText = display.meaningText
                            secondaryText = if (isActive) display.originalText else null
                        }
                        else -> {
                            // Default: Original Native Script
                            displayText = line.text
                            secondaryText = line.translationText ?: line.translations["en"]
                        }
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .graphicsLayer {
                                scaleX = scale
                                scaleY = scale
                                this.alpha = alpha
                                translationY = offsetY
                            }
                            .clip(RoundedCornerShape(14.dp))
                            .background(
                                if (isActive) HyperMeloColors.WarmPeach.copy(alpha = 0.08f)
                                else Color.Transparent
                            )
                            .border(
                                width = if (isActive) 2.dp else 0.dp,
                                color = if (isActive) HyperMeloColors.WarmPeach.copy(alpha = 0.6f) else Color.Transparent,
                                shape = RoundedCornerShape(14.dp)
                            )
                            .clickable {
                                onSeek(line.timeMs)
                            }
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        // Primary Lyric Text
                        Text(
                            text = displayText,
                            color = if (isActive) Color.White else HyperMeloColors.TextSecondary,
                            fontSize = if (isActive) 22.sp else 19.sp,
                            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                            lineHeight = 34.sp // Generous line height prevents Telugu/Hindi/Tamil/Malayalam diacritic clipping
                        )

                        // Secondary Contextual Subtitle (staggered 40ms)
                        if (!secondaryText.isNullOrBlank() && secondaryText != displayText) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = secondaryText,
                                color = if (isActive) HyperMeloColors.SoftPeach else HyperMeloColors.TextMuted,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Normal,
                                lineHeight = 20.sp,
                                modifier = Modifier.graphicsLayer {
                                    this.alpha = translationAlpha
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
