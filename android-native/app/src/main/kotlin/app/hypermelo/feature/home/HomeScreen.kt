package app.hypermelo.feature.home

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import coil.compose.AsyncImage

@Composable
fun HomeScreen(
    onTrackSelect: (Track) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val sampleTracks = listOf(
        Track(
            id = "anirudh-gaali-vaaluga",
            title = "Gaali Vaaluga",
            artist = "Anirudh Ravichander",
            album = "Agnyaathavaasi",
            durationSeconds = 258,
            artworkUrl = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
            mediaUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            source = "test_verified",
            language = "te"
        ),
        Track(
            id = "t1",
            title = "Midnight Reverie",
            artist = "Aetheria",
            album = "Neon Horizons",
            durationSeconds = 372,
            artworkUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80",
            mediaUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            source = "test_verified"
        ),
        Track(
            id = "t2",
            title = "Starlight Sonata",
            artist = "Kavya Sharma",
            album = "Celestial Waves",
            durationSeconds = 30,
            artworkUrl = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
            mediaUrl = "https://storage.googleapis.com/exoplayer-test-media-0/play.mp3",
            source = "test_verified"
        ),
        Track(
            id = "t3",
            title = "Obsidian Echoes",
            artist = "Vortex Flow",
            album = "Deep State",
            durationSeconds = 372,
            artworkUrl = "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80",
            mediaUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            source = "test_verified"
        ),
        Track(
            id = "t4",
            title = "Golden Mirage",
            artist = "Rishi Sen",
            album = "Saffron Sunset",
            durationSeconds = 30,
            artworkUrl = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80",
            mediaUrl = "https://storage.googleapis.com/exoplayer-test-media-0/play.mp3",
            source = "test_verified"
        )
    )

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(HyperMeloColors.Obsidian),
        contentPadding = PaddingValues(bottom = 100.dp)
    ) {
        // App Header
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "HYPERMELO",
                        color = HyperMeloColors.TextPrimary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = 2.5.sp
                    )
                    Text(
                        text = "Audiophile Experience",
                        color = HyperMeloColors.WarmPeach,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 1.sp
                    )
                }

                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(HyperMeloColors.GlassSurface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.GraphicEq,
                        contentDescription = "Sound Engine",
                        tint = HyperMeloColors.WarmPeach,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }

        // Hero Card
        item {
            HyperMeloGlassCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp)
                    .clickable { onTrackSelect(sampleTracks[0]) }
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.linearGradient(
                                listOf(
                                    Color(0xFF2D1815),
                                    HyperMeloColors.MidnightSurface
                                )
                            )
                        )
                        .padding(18.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(HyperMeloColors.Obsidian)
                        ) {
                            AsyncImage(
                                model = sampleTracks[0].artworkUrl,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .clip(CircleShape)
                                        .background(HyperMeloColors.WarmPeach)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "FEATURED TRACK",
                                    color = HyperMeloColors.WarmPeach,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = sampleTracks[0].title,
                                color = HyperMeloColors.TextPrimary,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = sampleTracks[0].artist,
                                color = HyperMeloColors.TextSecondary,
                                fontSize = 13.sp
                            )
                        }

                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(HyperMeloColors.WarmPeach),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = "Play",
                                tint = HyperMeloColors.Obsidian,
                                modifier = Modifier.size(26.dp)
                            )
                        }
                    }
                }
            }
        }

        // Quick Jumps
        item {
            Text(
                text = "QUICK ROTATION",
                color = HyperMeloColors.TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                QuickTile(title = "Daily Mix", modifier = Modifier.weight(1f))
                QuickTile(title = "Midnight Lo-Fi", modifier = Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                QuickTile(title = "Indie Acoustic", modifier = Modifier.weight(1f))
                QuickTile(title = "Takes & Snippets", modifier = Modifier.weight(1f))
            }
        }

        // Horizontal Carousel: Curated Picks
        item {
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = "CURATED FOR YOU",
                color = HyperMeloColors.TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )

            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                items(sampleTracks) { track ->
                    Column(
                        modifier = Modifier
                            .width(140.dp)
                            .clickable { onTrackSelect(track) }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(140.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(HyperMeloColors.GlassSurface)
                        ) {
                            AsyncImage(
                                model = track.artworkUrl,
                                contentDescription = track.title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
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
                }
            }
        }

        // Section: Recently Played Tracks
        item {
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "RECENTLY PLAYED",
                color = HyperMeloColors.TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )
        }

        items(sampleTracks) { track ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onTrackSelect(track) }
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(HyperMeloColors.GlassSurface)
                ) {
                    AsyncImage(
                        model = track.artworkUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                Spacer(modifier = Modifier.width(14.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = track.title,
                        color = HyperMeloColors.TextPrimary,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "${track.artist} • ${track.album}",
                        color = HyperMeloColors.TextSecondary,
                        fontSize = 12.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                IconButton(onClick = { /* More actions */ }) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "More",
                        tint = HyperMeloColors.TextMuted
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickTile(
    title: String,
    modifier: Modifier = Modifier
) {
    HyperMeloGlassCard(
        modifier = modifier.height(54.dp),
        cornerRadius = 10.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(HyperMeloColors.WarmPeach.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = null,
                    tint = HyperMeloColors.WarmPeach,
                    modifier = Modifier.size(16.dp)
                )
            }
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = title,
                color = HyperMeloColors.TextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

