package app.hypermelo.core.model

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val email: String,
    val displayName: String,
    val avatarUrl: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val isAnonymous: Boolean = false
)

