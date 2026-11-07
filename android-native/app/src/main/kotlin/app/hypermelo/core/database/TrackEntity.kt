package app.hypermelo.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey
import app.hypermelo.core.model.Track

@Entity(tableName = "tracks")
data class TrackEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationSeconds: Int,
    val artworkUrl: String?,
    val mediaUrl: String?,
    val lyricsId: String?,
    val language: String,
    val isLiked: Boolean,
    val isDownloaded: Boolean,
    val source: String,
    val lastPlayedAt: Long = 0L,
    val playCount: Int = 0
) {
    fun toDomain(): Track = Track(
        id = id,
        title = title,
        artist = artist,
        album = album,
        durationSeconds = durationSeconds,
        artworkUrl = artworkUrl,
        mediaUrl = mediaUrl,
        lyricsId = lyricsId,
        language = language,
        isLiked = isLiked,
        isDownloaded = isDownloaded,
        source = source
    )

    companion object {
        fun fromDomain(track: Track): TrackEntity = TrackEntity(
            id = track.id,
            title = track.title,
            artist = track.artist,
            album = track.album,
            durationSeconds = track.durationSeconds,
            artworkUrl = track.artworkUrl,
            mediaUrl = track.mediaUrl,
            lyricsId = track.lyricsId,
            language = track.language,
            isLiked = track.isLiked,
            isDownloaded = track.isDownloaded,
            source = track.source
        )
    }
}

