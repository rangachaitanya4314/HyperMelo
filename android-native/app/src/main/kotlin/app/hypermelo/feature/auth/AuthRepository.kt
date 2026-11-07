package app.hypermelo.feature.auth

import app.hypermelo.core.common.Resource
import app.hypermelo.core.model.User
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed class AuthState {
    data object Unauthenticated : AuthState()
    data class Authenticated(val user: User) : AuthState()
    data class ServerPending(val reason: String) : AuthState()
}

interface AuthRepository {
    val authState: Flow<AuthState>
    suspend fun login(email: String, password: String): Resource<User>
    suspend fun register(email: String, password: String, displayName: String): Resource<User>
    suspend fun logout(): Resource<Unit>
    suspend fun getCurrentUser(): User?
}

class PendingServerAuthRepository : AuthRepository {
    private val _authState = MutableStateFlow<AuthState>(
        AuthState.ServerPending(
            "HyperMelo web identity is currently local-first (PBKDF2 in browser localStorage). " +
            "A shared remote session API (/api/v1/auth) is required before cross-platform login can be active."
        )
    )
    override val authState: Flow<AuthState> = _authState.asStateFlow()

    override suspend fun login(email: String, password: String): Resource<User> {
        return Resource.Error("Server authentication service endpoint pending backend deployment.")
    }

    override suspend fun register(email: String, password: String, displayName: String): Resource<User> {
        return Resource.Error("Server authentication service endpoint pending backend deployment.")
    }

    override suspend fun logout(): Resource<Unit> {
        _authState.value = AuthState.Unauthenticated
        return Resource.Success(Unit)
    }

    override suspend fun getCurrentUser(): User? = null
}

