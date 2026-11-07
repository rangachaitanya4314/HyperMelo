package app.hypermelo.feature.library

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DownloadDone
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.VoiceChat
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hypermelo.core.designsystem.HyperMeloColors
import app.hypermelo.core.designsystem.HyperMeloGlassCard
import app.hypermelo.core.model.Track
import coil.compose.AsyncImage

@Composable
fun LibraryScreen(
    onTrackSelect: (Track) -> Unit = {},
    modifier: Modifier = Modifier
) {
    var selectedTabIndex by remember { mutableIntStateOf(0) }
    val tabs = listOf(
        Pair("Takes", Icons.Default.VoiceChat),
        Pair("Liked", Icons.Default.Favorite),
        Pair("Playlists", Icons.Default.QueueMusic),
        Pair("History", Icons.Default.History),
        Pair("Downloads", Icons.Default.DownloadDone)
    )

    val sampleLibraryTracks = listOf(
        Track(
            id = "lib-1",
            title = "Midnight Reverie",
            artist = "Aetheria",
            album = "Neon Horizons",
            durationSeconds = 372,
            artworkUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80",
            mediaUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            source = "test_verified",
            isLiked = true,
            isDownloaded = true
        ),
        Track(
            id = "lib-2",
            title = "Starlight Sonata",
            artist = "Kavya Sharma",
            album = "Celestial Waves",
            durationSeconds = 30,
            artworkUrl = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
            mediaUrl = "https://storage.googleapis.com/exoplayer-test-media-0/play.mp3",
            source = "test_verified",
            isLiked = true,
            isDownloaded = false
        ),
        Track(
            id = "lib-3",
            title = "Obsidian Echoes",
            artist = "Vortex Flow",
            album = "Deep State",
            durationSeconds = 372,
            artworkUrl = "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80",
            mediaUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            source = "test_verified",
            isLiked = false,
            isDownloaded = true
        )
    )

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(HyperMeloColors.Obsidian),
        contentPadding = PaddingValues(bottom = 100.dp)
    ) {
        item {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = "YOUR LIBRARY",
                    color = HyperMeloColors.TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                )
                Text(
                    text = "Playlists, saved tracks, takes and offline music",
                    color = HyperMeloColors.TextSecondary,
                    fontSize = 13.sp
                )
            }
        }

        // 5 Library Tabs
        item {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                itemsIndexed(tabs) { index, (name, icon) ->
                    val isSelected = selectedTabIndex == index
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (isSelected) HyperMeloColors.WarmPeach else HyperMeloColors.GlassSurface
                            )
                            .clickable { selectedTabIndex = index }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = if (isSelected) HyperMeloColors.Obsidian else HyperMeloColors.TextPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = name,
                            color = if (isSelected) HyperMeloColors.Obsidian else HyperMeloColors.TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                        )
                    }
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(20.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${tabs[selectedTabIndex].first.uppercase()} (${sampleLibraryTracks.size})",
                    color = HyperMeloColors.TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
            }
        }

        items(sampleLibraryTracks) { track ->
            HyperMeloGlassCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 4.dp)
                    .clickable { onTrackSelect(track) },
                cornerRadius = 10.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
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
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = track.artist,
                            color = HyperMeloColors.TextSecondary,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    if (track.isDownloaded) {
                        Icon(
                            imageVector = Icons.Default.DownloadDone,
                            contentDescription = "Downloaded",
                            tint = HyperMeloColors.WarmPeach,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }

                    IconButton(onClick = { /* Track actions */ }, modifier = Modifier.size(32.dp)) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = "Actions",
                            tint = HyperMeloColors.TextMuted,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

