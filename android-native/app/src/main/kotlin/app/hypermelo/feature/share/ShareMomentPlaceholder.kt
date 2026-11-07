package app.hypermelo.feature.share

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.IosShare
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import app.hypermelo.core.model.Track

@Composable
fun ShareMomentPlaceholder(
    track: Track? = null,
    onDismiss: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(HyperMeloColors.Obsidian)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "SHARE MOMENT",
                color = HyperMeloColors.WarmPeach,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Close",
                    tint = HyperMeloColors.TextPrimary
                )
            }
        }

        // Share Card Preview
        HyperMeloGlassCard(
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .aspectRatio(0.85f),
            cornerRadius = 20.dp
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF2C1917), HyperMeloColors.MidnightSurface)
                        )
                    )
                    .padding(20.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "HYPERMELO",
                            color = HyperMeloColors.WarmPeach,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 2.sp
                        )
                        Text(
                            text = "24-BIT HI-RES",
                            color = HyperMeloColors.TextSecondary,
                            fontSize = 10.sp
                        )
                    }

                    Column {
                        Text(
                            text = "\"Under the obsidian skyline, we fade away\"",
                            color = HyperMeloColors.TextPrimary,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            lineHeight = 24.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "In the dark night, our paths cross",
                            color = HyperMeloColors.SoftPeach,
                            fontSize = 13.sp
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(HyperMeloColors.GlassSurface)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = track?.title ?: "Midnight Reverie",
                                color = HyperMeloColors.TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = track?.artist ?: "Aetheria",
                                color = HyperMeloColors.TextSecondary,
                                fontSize = 11.sp
                            )
                        }
                    }
                }
            }
        }

        // Action Button
        Button(
            onClick = { /* Export Pipeline in Phase 4 */ },
            colors = ButtonDefaults.buttonColors(
                containerColor = HyperMeloColors.WarmPeach,
                contentColor = HyperMeloColors.Obsidian
            ),
            modifier = Modifier.fillMaxWidth(0.9f)
        ) {
            Icon(Icons.Default.IosShare, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Export Story Card (Phase 4)", fontWeight = FontWeight.Bold)
        }
    }
}

