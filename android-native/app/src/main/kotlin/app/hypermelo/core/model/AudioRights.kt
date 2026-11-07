package app.hypermelo.core.model

import kotlinx.serialization.Serializable

@Serializable
data class AudioRights(
    val canStream: Boolean = true,
    val canDownload: Boolean = true,
    val isExplicit: Boolean = false,
    val tier: String = "free"
)

