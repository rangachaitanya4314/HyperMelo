package app.hypermelo.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val HyperMeloColorScheme = darkColorScheme(
    primary = HyperMeloColors.WarmPeach,
    onPrimary = HyperMeloColors.Obsidian,
    primaryContainer = HyperMeloColors.PeachDeep,
    onPrimaryContainer = HyperMeloColors.SoftPeach,
    secondary = HyperMeloColors.SoftPeach,
    onSecondary = HyperMeloColors.Obsidian,
    background = HyperMeloColors.Obsidian,
    onBackground = HyperMeloColors.TextPrimary,
    surface = HyperMeloColors.MidnightSurface,
    onSurface = HyperMeloColors.TextPrimary,
    surfaceVariant = HyperMeloColors.GlassSurface,
    onSurfaceVariant = HyperMeloColors.TextSecondary,
    outline = HyperMeloColors.GlassBorder,
    outlineVariant = HyperMeloColors.SubtleBorder
)

@Composable
fun HyperMeloTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = HyperMeloColorScheme,
        content = content
    )
}

