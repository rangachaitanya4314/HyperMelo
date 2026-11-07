package app.hypermelo.core.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "user_preferences")

class UserPreferencesDataStore(private val context: Context) {
    companion object {
        val KEY_AUDIO_QUALITY = stringPreferencesKey("audio_quality")
        val KEY_FLOATING_LYRICS = booleanPreferencesKey("floating_lyrics_enabled")
        val KEY_AMBIENT_GLOW = booleanPreferencesKey("ambient_glow_enabled")
        val KEY_AUTH_TOKEN = stringPreferencesKey("auth_token")
    }

    val audioQuality: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[KEY_AUDIO_QUALITY] ?: "high"
    }

    val floatingLyricsEnabled: Flow<Boolean> = context.dataStore.data.map { preferences ->
        preferences[KEY_FLOATING_LYRICS] ?: true
    }

    val ambientGlowEnabled: Flow<Boolean> = context.dataStore.data.map { preferences ->
        preferences[KEY_AMBIENT_GLOW] ?: true
    }

    suspend fun setAudioQuality(quality: String) {
        context.dataStore.edit { preferences ->
            preferences[KEY_AUDIO_QUALITY] = quality
        }
    }

    suspend fun setFloatingLyricsEnabled(enabled: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[KEY_FLOATING_LYRICS] = enabled
        }
    }
}

