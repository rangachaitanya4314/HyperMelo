package app.hypermelo.core.model

import kotlinx.serialization.Serializable

@Serializable
data class Track(
    val id: String,
    val title: String,
    val artist: String,
    val album: String = "",
    val durationSeconds: Int = 0,
    val artworkUrl: String? = null,
    val mediaUrl: String? = null,
    val lyricsId: String? = null,
    val language: String = "en",
    val isLiked: Boolean = false,
    val isDownloaded: Boolean = false,
    val source: String = "saavn" // saavn, netease, local
)

