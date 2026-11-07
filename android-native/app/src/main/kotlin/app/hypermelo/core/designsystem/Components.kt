package app.hypermelo.core.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun HyperMeloGlassCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 16.dp,
    borderWidth: Dp = 1.dp,
    backgroundColor: Color = HyperMeloColors.GlassSurface,
    borderColor: Color = HyperMeloColors.GlassBorder,
    content: @Composable BoxScope.() -> Unit
) {
    val shape = RoundedCornerShape(cornerRadius)
    Box(
        modifier = modifier
            .clip(shape)
            .background(backgroundColor)
            .border(BorderStroke(borderWidth, borderColor), shape),
        content = content
    )
}

@Composable
fun HyperMeloAtmosphereBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    val gradient = Brush.verticalGradient(
        colors = listOf(
            HyperMeloColors.MidnightSurface,
            HyperMeloColors.Obsidian
        )
    )
    Box(
        modifier = modifier.background(gradient),
        content = content
    )
}

