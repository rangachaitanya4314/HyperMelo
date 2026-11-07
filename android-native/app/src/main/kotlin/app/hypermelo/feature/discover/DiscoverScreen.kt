package app.hypermelo.feature.discover

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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.Audiotrack
import androidx.compose.material.icons.filled.Radio
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hypermelo.core.designsystem.HyperMeloColors
import app.hypermelo.core.designsystem.HyperMeloGlassCard

@Composable
fun DiscoverScreen(
    modifier: Modifier = Modifier
) {
    val genres = listOf("All", "Synthwave", "Cinematic", "Lo-Fi", "Acoustic", "Ambient", "Classical")
    val curatedCategories = listOf(
        Pair("Midnight Sessions", "Deep atmospheric downtempo"),
        Pair("Audiophile Master Cuts", "Uncompressed studio clarity"),
        Pair("Indie Spectrum", "Emerging singer-songwriters"),
        Pair("Acoustic Sanctuary", "Warm organic instrumentation")
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
                    text = "DISCOVER",
                    color = HyperMeloColors.TextPrimary,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 2.sp
                )
                Text(
                    text = "Explore sonic landscapes and master recordings",
                    color = HyperMeloColors.TextSecondary,
                    fontSize = 13.sp
                )
            }
        }

        // Genre filter pills
        item {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(genres) { genre ->
                    val isSelected = genre == "All"
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(
                                if (isSelected) HyperMeloColors.WarmPeach else HyperMeloColors.GlassSurface
                            )
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = genre,
                            color = if (isSelected) HyperMeloColors.Obsidian else HyperMeloColors.TextPrimary,
                            fontSize = 13.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = "CURATED AUDIO EXPERIENCES",
                color = HyperMeloColors.TextSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )
        }

        items(curatedCategories) { (title, subtitle) ->
            HyperMeloGlassCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp)
                    .clickable { }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(50.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                Brush.linearGradient(
                                    listOf(HyperMeloColors.WarmPeach.copy(alpha = 0.3f), HyperMeloColors.MidnightSurface)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Album,
                            contentDescription = null,
                            tint = HyperMeloColors.WarmPeach
                        )
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column {
                        Text(
                            text = title,
                            color = HyperMeloColors.TextPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = subtitle,
                            color = HyperMeloColors.TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

