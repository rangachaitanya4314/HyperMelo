package app.hypermelo.core.network

import android.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

object JioSaavnMediaDecryptor {
    private const val DES_KEY = "3834363538333239" // ASCII "84658329"

    /**
     * Replicates audioDecryptor.ts DES-ECB deciphering for JioSaavn stream URLs.
     */
    fun decryptMediaUrl(encryptedUrl: String): String? {
        return try {
            val keyBytes = DES_KEY.toByteArray(Charsets.UTF_8)
            val keySpec = SecretKeySpec(keyBytes, "DES")
            val cipher = Cipher.getInstance("DES/ECB/PKCS5Padding")
            cipher.init(Cipher.DECRYPT_MODE, keySpec)
            val decodedBytes = Base64.decode(encryptedUrl, Base64.DEFAULT)
            val decryptedBytes = cipher.doFinal(decodedBytes)
            val rawUrl = String(decryptedBytes, Charsets.UTF_8)
            // Replace _96.mp4 with _320.mp4 for high-quality audio
            rawUrl.replace("_96.mp4", "_320.mp4")
                .replace(".mp4", ".mp4")
        } catch (e: Exception) {
            null
        }
    }
}

