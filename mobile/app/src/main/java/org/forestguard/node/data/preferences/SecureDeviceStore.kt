package org.forestguard.node.data.preferences

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class DeviceCredentials(val deviceCode: String, val secret: String)

/** AES-GCM encrypted credentials with a non-exportable AES key held by Android Keystore. */
class SecureDeviceStore(context: Context) {
    private val preferences = context.getSharedPreferences("device_credentials_encrypted", Context.MODE_PRIVATE)
    private val keyAlias = "forestguard.device.credentials.v1"

    fun read(): DeviceCredentials? {
        val ciphertext = preferences.getString(KEY_CIPHERTEXT, null) ?: return null
        val iv = preferences.getString(KEY_IV, null)?.let(::decode) ?: return null
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(128, iv))
            val json = JSONObject(String(cipher.doFinal(decode(ciphertext)), Charsets.UTF_8))
            DeviceCredentials(json.getString("deviceCode"), json.getString("secret"))
        } catch (_: Exception) {
            null
        }
    }

    fun save(credentials: DeviceCredentials) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val payload = JSONObject()
            .put("deviceCode", credentials.deviceCode)
            .put("secret", credentials.secret)
            .toString()
            .toByteArray(Charsets.UTF_8)
        val encrypted = encode(cipher.doFinal(payload))
        val iv = encode(cipher.iv)
        check(preferences.edit().putString(KEY_CIPHERTEXT, encrypted).putString(KEY_IV, iv).commit()) {
            "Unable to save encrypted device credentials"
        }
    }

    fun clear() {
        preferences.edit().clear().commit()
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        if (keyStore.containsAlias(keyAlias)) keyStore.deleteEntry(keyAlias)
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        (keyStore.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    private fun encode(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun decode(value: String) = Base64.decode(value, Base64.NO_WRAP)

    private companion object {
        const val KEY_CIPHERTEXT = "ciphertext"
        const val KEY_IV = "iv"
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
