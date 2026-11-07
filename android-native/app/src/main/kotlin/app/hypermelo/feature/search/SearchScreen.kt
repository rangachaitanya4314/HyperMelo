package app.hypermelo.feature.search

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hypermelo.core.designsystem.HyperMeloColors
import app.hypermelo.core.designsystem.HyperMeloGlassCard

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SearchScreen(
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    val trendingSearches = listOf("Aetheria", "Neon Horizons", "Synthwave 2026", "Kavya Sharma", "Deep Ambience", "Vortex Flow")
    val recentSearches = listOf("Midnight Reverie", "Starlight Sonata", "Audiophile Master")

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(HyperMeloColors.Obsidian)
            .padding(horizontal = 20.dp, vertical = 16.dp)
    ) {
        Text(
            text = "SEARCH",
            color = HyperMeloColors.TextPrimary,
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 2.sp
        )
        Text(
            text = "Search tracks, artists, albums and lyrics",
            color = HyperMeloColors.TextSecondary,
            fontSize = 13.sp
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Glass Search Input
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = {
                Text("Search music or lyrics...", color = HyperMeloColors.TextMuted, fontSize = 14.sp)
            },
            leadingIcon = {
                Icon(Icons.Default.Search, contentDescription = "Search", tint = HyperMeloColors.WarmPeach)
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear", tint = HyperMeloColors.TextSecondary)
                    }
                }
            },
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = HyperMeloColors.GlassSurface,
                unfocusedContainerColor = HyperMeloColors.GlassSurface,
                focusedBorderColor = HyperMeloColors.WarmPeach,
                unfocusedBorderColor = HyperMeloColors.GlassBorder,
                focusedTextColor = HyperMeloColors.TextPrimary,
                unfocusedTextColor = HyperMeloColors.TextPrimary
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Recent Searches
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.History, contentDescription = null, tint = HyperMeloColors.WarmPeach, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "RECENT SEARCHES",
                color = HyperMeloColors.TextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            recentSearches.forEach { term ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(HyperMeloColors.GlassSurface)
                        .clickable { searchQuery = term }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(text = term, color = HyperMeloColors.TextPrimary, fontSize = 13.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Trending Topics
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.TrendingUp, contentDescription = null, tint = HyperMeloColors.WarmPeach, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "TRENDING",
                color = HyperMeloColors.TextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            trendingSearches.forEach { term ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(HyperMeloColors.GlassSurface)
                        .clickable { searchQuery = term }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(text = term, color = HyperMeloColors.SoftPeach, fontSize = 13.sp)
                }
            }
        }
    }
}

