package org.forestguard.node.data.api

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Header
import retrofit2.http.POST
import java.net.URI

data class DeviceAuthResponse(
    val deviceId: String,
    val deviceCode: String,
    val name: String,
    val status: String,
    val monitoringStatus: String,
)

data class HeartbeatRequest(
    val requestId: String,
    val battery: Int?,
    val latitude: Double?,
    val longitude: Double?,
    val accuracy: Double?,
    val networkStatus: String,
    val monitoringStatus: String,
    val appVersion: String,
    val firmwareVersion: String,
)

data class HeartbeatResponse(val ok: Boolean, val receivedAt: String)

interface DeviceApi {
    @POST("devices/auth")
    suspend fun authenticate(
        @Header("x-device-id") deviceCode: String,
        @Header("x-device-token") secret: String,
    ): DeviceAuthResponse

    @POST("devices/heartbeat")
    suspend fun heartbeat(
        @Header("x-device-id") deviceCode: String,
        @Header("x-device-token") secret: String,
        @retrofit2.http.Body request: HeartbeatRequest,
    ): HeartbeatResponse
}

fun deviceApi(baseUrl: String): DeviceApi = Retrofit.Builder()
    .baseUrl(baseUrl.ensureApiBaseUrl())
    .addConverterFactory(GsonConverterFactory.create())
    .build()
    .create(DeviceApi::class.java)

fun String.ensureApiBaseUrl(): String {
    val normalized = trim().let { if (it.endsWith('/')) it else "$it/" }
    val uri = runCatching { URI(normalized) }.getOrNull()
    val isHttps = uri?.scheme.equals("https", ignoreCase = true) && !uri?.host.isNullOrBlank()
    val isEmulatorHttp = uri?.scheme.equals("http", ignoreCase = true) && uri?.host == "10.0.2.2"
    require(isHttps || isEmulatorHttp) {
        "Use HTTPS for remote servers. HTTP is permitted only for the Android emulator host."
    }
    require(normalized.endsWith("/api/")) { "Backend URL must end in /api/" }
    return normalized
}
