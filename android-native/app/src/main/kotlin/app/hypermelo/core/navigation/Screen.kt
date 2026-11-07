package app.hypermelo.core.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Search
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Home : Screen("home", "Home", Icons.Default.Home)
    data object Discover : Screen("discover", "Discover", Icons.Default.Explore)
    data object Search : Screen("search", "Search", Icons.Default.Search)
    data object Library : Screen("library", "Library", Icons.Default.LibraryMusic)
    data object Player : Screen("player", "Now Playing", Icons.Default.PlayCircle)
    data object Auth : Screen("auth", "Account", Icons.Default.AccountCircle)

    companion object {
        val bottomNavScreens = listOf(Home, Discover, Search, Library)
    }
}

