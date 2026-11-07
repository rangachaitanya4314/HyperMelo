package app.hypermelo

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import app.hypermelo.core.designsystem.HyperMeloColors
import app.hypermelo.core.designsystem.HyperMeloGlassCard
import app.hypermelo.core.model.Track
import app.hypermelo.core.navigation.Screen
import app.hypermelo.core.playback.PlaybackManager
import app.hypermelo.core.playback.PlaybackSnapshot
import app.hypermelo.core.playback.PlaybackSourceResolver
import app.hypermelo.feature.auth.AuthScreen
import app.hypermelo.feature.discover.DiscoverScreen
import app.hypermelo.feature.home.HomeScreen
import app.hypermelo.feature.library.LibraryScreen
import app.hypermelo.feature.lyrics.FloatingLyricsScreen
import app.hypermelo.feature.player.NowPlayingScreen
import app.hypermelo.feature.search.SearchScreen
import app.hypermelo.feature.share.ShareMomentPlaceholder
import coil.compose.AsyncImage

@Composable
fun HyperMeloApp() {
    val context = LocalContext.current
    val playbackManager = remember { PlaybackManager.getInstance(context) }
    val playbackSnapshot by playbackManager.snapshot.collectAsState()

    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    var isNowPlayingOpen by remember { mutableStateOf(false) }
    var isLyricsOpen by remember { mutableStateOf(false) }
    var isShareOpen by remember { mutableStateOf(false) }

    // Initialize initial queue if empty
    LaunchedEffect(Unit) {
        if (playbackSnapshot.queue.isEmpty()) {
            playbackManager.setQueue(
                listOf(
                    PlaybackSourceResolver.GAALI_VAALUGA_TRACK,
                    PlaybackSourceResolver.TEST_TRACK_1,
                    PlaybackSourceResolver.TEST_TRACK_2
                ),
                startIndex = 0
            )
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(HyperMeloColors.Obsidian)
            .statusBarsPadding()
            .navigationBarsPadding()
    ) {
        Scaffold(
            containerColor = HyperMeloColors.Obsidian,
            bottomBar = {
                Column(
                    modifier = Modifier.background(HyperMeloColors.Obsidian)
                ) {
                    // Mini Player Dock (backed by real PlaybackManager)
                    playbackSnapshot.currentTrack?.let { track ->
                        MiniPlayerBar(
                            track = track,
                            snapshot = playbackSnapshot,
                            onPlayPause = { playbackManager.togglePlayPause() },
                            onClick = { isNowPlayingOpen = true }
                        )
                    }

                    // Bottom Navigation Bar
                    NavigationBar(
                        containerColor = HyperMeloColors.MidnightSurface,
                        contentColor = HyperMeloColors.TextPrimary,
                        tonalElevation = 0.dp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(64.dp)
                            .border(1.dp, HyperMeloColors.SubtleBorder)
                    ) {
                        Screen.bottomNavScreens.forEach { screen ->
                            val isSelected = currentRoute == screen.route
                            NavigationBarItem(
                                selected = isSelected,
                                onClick = {
                                    navController.navigate(screen.route) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = {
                                    Icon(
                                        imageVector = screen.icon,
                                        contentDescription = screen.title,
                                        modifier = Modifier.size(22.dp)
                                    )
                                },
                                label = {
                                    Text(
                                        text = screen.title,
                                        fontSize = 10.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                    )
                                },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = HyperMeloColors.WarmPeach,
                                    selectedTextColor = HyperMeloColors.WarmPeach,
                                    unselectedIconColor = HyperMeloColors.TextMuted,
                                    unselectedTextColor = HyperMeloColors.TextMuted,
                                    indicatorColor = HyperMeloColors.WarmPeach.copy(alpha = 0.15f)
                                )
                            )
                        }
                    }
                }
            }
        ) { paddingValues ->
            NavHost(
                navController = navController,
                startDestination = Screen.Home.route,
                modifier = Modifier.padding(paddingValues)
            ) {
                composable(Screen.Home.route) {
                    HomeScreen(
                        onTrackSelect = { track ->
                            playbackManager.playTrack(track)
                            isNowPlayingOpen = true
                        }
                    )
                }
                composable(Screen.Discover.route) {
                    DiscoverScreen()
                }
                composable(Screen.Search.route) {
                    SearchScreen()
                }
                composable(Screen.Library.route) {
                    LibraryScreen(
                        onTrackSelect = { track ->
                            playbackManager.playTrack(track)
                            isNowPlayingOpen = true
                        }
                    )
                }
                composable(Screen.Auth.route) {
                    AuthScreen()
                }
            }
        }

        // Full Screen Now Playing Overlay (backed by real PlaybackManager)
        AnimatedVisibility(
            visible = isNowPlayingOpen,
            enter = slideInVertically(initialOffsetY = { it }),
            exit = slideOutVertically(targetOffsetY = { it })
        ) {
            NowPlayingScreen(
                snapshot = playbackSnapshot,
                onPlayPause = { playbackManager.togglePlayPause() },
                onPrevious = { playbackManager.skipToPrevious() },
                onNext = { playbackManager.skipToNext() },
                onSeek = { positionMs -> playbackManager.seekTo(positionMs) },
                onShuffle = { playbackManager.toggleShuffle() },
                onRepeat = { playbackManager.cycleRepeatMode() },
                onQueueSelect = { index -> playbackManager.selectQueueItem(index) },
                onCollapse = { isNowPlayingOpen = false },
                onLyricsClick = { isLyricsOpen = true }
            )
        }

        // Floating Lyrics Overlay
        AnimatedVisibility(
            visible = isLyricsOpen,
            enter = slideInVertically(initialOffsetY = { it }),
            exit = slideOutVertically(targetOffsetY = { it })
        ) {
            FloatingLyricsScreen(
                snapshot = playbackSnapshot,
                onSeek = { positionMs -> playbackManager.seekTo(positionMs) },
                onPlayPause = { playbackManager.togglePlayPause() },
                onDismiss = { isLyricsOpen = false }
            )
        }

        // Share Moment Overlay
        AnimatedVisibility(
            visible = isShareOpen,
            enter = slideInVertically(initialOffsetY = { it }),
            exit = slideOutVertically(targetOffsetY = { it })
        ) {
            ShareMomentPlaceholder(
                track = playbackSnapshot.currentTrack,
                onDismiss = { isShareOpen = false }
            )
        }
    }
}

@Composable
fun MiniPlayerBar(
    track: Track,
    snapshot: PlaybackSnapshot,
    onPlayPause: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    HyperMeloGlassCard(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clickable { onClick() },
        cornerRadius = 14.dp,
        backgroundColor = HyperMeloColors.MidnightSurface
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(HyperMeloColors.Obsidian)
            ) {
                AsyncImage(
                    model = track.artworkUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = track.title,
                    color = HyperMeloColors.TextPrimary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${track.artist} • ${if (snapshot.isPlaying) "Playing" else "Paused"}",
                    color = HyperMeloColors.WarmPeach,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(HyperMeloColors.WarmPeach)
                    .clickable { onPlayPause() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (snapshot.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = if (snapshot.isPlaying) "Pause" else "Play",
                    tint = HyperMeloColors.Obsidian,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
