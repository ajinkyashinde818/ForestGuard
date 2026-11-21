package org.forestguard.node.data.repository

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.tasks.await
import org.forestguard.node.BuildConfig
import org.forestguard.node.data.api.HeartbeatRequest
import org.forestguard.node.data.api.deviceApi
import org.forestguard.node.data.api.ensureApiBaseUrl
import org.forestguard.node.data.database.DeviceConfiguration
import org.forestguard.node.data.database.MonitoringDatabase
import org.forestguard.node.data.database.PendingHeartbeat
import org.forestguard.node.data.database.PendingLocation
import org.forestguard.node.data.preferences.DeviceCredentials
import org.forestguard.node.data.preferences.SecureDeviceStore
import java.util.UUID

enum class ConnectionState { ONLINE, OFFLINE, CONNECTING, ERROR }

class MonitoringRepository(context: Context) {
    private val appContext = context.applicationContext
    private val dao = MonitoringDatabase.get(appContext).dao()
    private val credentials = SecureDeviceStore(appContext)
    private val settings = appContext.getSharedPreferences("monitoring_settings", Context.MODE_PRIVATE)
    private val fusedLocation = LocationServices.getFusedLocationProviderClient(appContext)
    private val connectivity = appContext.getSystemService(ConnectivityManager::class.java)

    val configuration: Flow<DeviceConfiguration?> = dao.configuration()
    val pendingHeartbeatCount: Flow<Int> = dao.pendingHeartbeatCount()
    val pendingLocationCount: Flow<Int> = dao.pendingLocationCount()
    val isMonitoring: Boolean get() = settings.getBoolean(KEY_MONITORING, false)
    val heartbeatIntervalMinutes: Int get() = settings.getInt(KEY_HEARTBEAT, DEFAULT_HEARTBEAT_MINUTES).coerceIn(1, 60)
    val gpsIntervalMinutes: Int get() = settings.getInt(KEY_GPS, DEFAULT_GPS_MINUTES).coerceIn(1, 60)
    val backendUrl: String get() = settings.getString(KEY_URL, BuildConfig.API_BASE_URL) ?: BuildConfig.API_BASE_URL
    val lastKnownCoordinates: Pair<Double, Double>? get() {
        val lat = settings.getString(KEY_LAST_LAT, null)?.toDoubleOrNull() ?: return null
        val lon = settings.getString(KEY_LAST_LON, null)?.toDoubleOrNull() ?: return null
        return lat to lon
    }

    fun deviceCredentials(): DeviceCredentials? = credentials.read()

    suspend fun hasPendingData() = dao.pendingHeartbeats().isNotEmpty() || dao.pendingLocations().isNotEmpty()

    fun isNetworkConnected(): Boolean {
        val network = connectivity.activeNetwork ?: return false
        val capabilities = connectivity.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    fun batteryPercent(): Int? {
        val manager = appContext.getSystemService(BatteryManager::class.java)
        return manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).takeIf { it in 0..100 }
    }

    suspend fun pair(deviceCode: String, deviceSecret: String, url: String): DeviceConfiguration {
        val normalizedUrl = url.ensureApiBaseUrl()
        val response = deviceApi(normalizedUrl).authenticate(deviceCode.trim(), deviceSecret.trim())
        credentials.save(DeviceCredentials(deviceCode.trim(), deviceSecret.trim()))
        settings.edit().putString(KEY_URL, normalizedUrl).apply()
        val config = DeviceConfiguration(
            deviceCode = response.deviceCode,
            deviceName = response.name,
            backendUrl = normalizedUrl,
            heartbeatIntervalMinutes = heartbeatIntervalMinutes,
            gpsIntervalMinutes = gpsIntervalMinutes,
            monitoringEnabled = false,
            lastSyncedAt = null,
        )
        dao.saveConfiguration(config)
        return config
    }

    suspend fun updateSettings(url: String, heartbeatMinutes: Int, gpsMinutes: Int) {
        val normalized = url.ensureApiBaseUrl()
        require(heartbeatMinutes in 1..60) { "Heartbeat interval must be 1–60 minutes" }
        require(gpsMinutes in 1..60) { "GPS interval must be 1–60 minutes" }
        settings.edit().putString(KEY_URL, normalized)
            .putInt(KEY_HEARTBEAT, heartbeatMinutes)
            .putInt(KEY_GPS, gpsMinutes)
            .apply()
        configurationSnapshot()?.let { existing ->
            dao.saveConfiguration(existing.copy(backendUrl = normalized, heartbeatIntervalMinutes = heartbeatMinutes, gpsIntervalMinutes = gpsMinutes))
        }
    }

    suspend fun setMonitoring(enabled: Boolean) {
        settings.edit().putBoolean(KEY_MONITORING, enabled).apply()
        configurationSnapshot()?.let { dao.saveConfiguration(it.copy(monitoringEnabled = enabled)) }
    }

    suspend fun captureAndSendHeartbeat(forceLocation: Boolean = false): Boolean {
        val device = credentials.read() ?: return false
        val requestId = UUID.randomUUID().toString()
        val currentLocation = if (forceLocation && hasLocationPermission()) getLocation() else null
        val locationId = currentLocation?.let {
            requestId.also { id -> dao.insertLocation(PendingLocation(id, it.latitude, it.longitude, it.accuracy.toDouble(), System.currentTimeMillis())) }
        }
        val payload = HeartbeatRequest(
            requestId = requestId,
            battery = batteryPercent(),
            latitude = currentLocation?.latitude ?: settings.getString(KEY_LAST_LAT, null)?.toDoubleOrNull(),
            longitude = currentLocation?.longitude ?: settings.getString(KEY_LAST_LON, null)?.toDoubleOrNull(),
            accuracy = currentLocation?.accuracy?.toDouble() ?: settings.getString(KEY_LAST_ACCURACY, null)?.toDoubleOrNull(),
            networkStatus = if (isNetworkConnected()) "CONNECTED" else "DISCONNECTED",
            monitoringStatus = if (isMonitoring) "ACTIVE" else "STOPPED",
            appVersion = appVersion(),
            firmwareVersion = Build.VERSION.RELEASE,
        )
        currentLocation?.let { location ->
            settings.edit().putString(KEY_LAST_LAT, location.latitude.toString())
                .putString(KEY_LAST_LON, location.longitude.toString())
                .putString(KEY_LAST_ACCURACY, location.accuracy.toString()).apply()
        }
        return try {
            deviceApi(backendUrl).heartbeat(device.deviceCode, device.secret, payload)
            locationId?.let { dao.deleteLocation(it) }
            configurationSnapshot()?.let { dao.saveConfiguration(it.copy(lastSyncedAt = System.currentTimeMillis())) }
            true
        } catch (_: Exception) {
            dao.insertHeartbeat(payload.toPending(requestId))
            false
        }
    }

    suspend fun syncPendingHeartbeats(): Boolean {
        val device = credentials.read() ?: return false
        for (pending in dao.pendingHeartbeats()) {
            try {
                deviceApi(backendUrl).heartbeat(device.deviceCode, device.secret, pending.toRequest())
                dao.deleteHeartbeat(pending.id)
                dao.deleteLocation(pending.id)
                configurationSnapshot()?.let { dao.saveConfiguration(it.copy(lastSyncedAt = System.currentTimeMillis())) }
            } catch (_: Exception) {
                return false
            }
        }
        return syncPendingLocations(device.deviceCode, device.secret)
    }

    suspend fun syncPendingLocations(): Boolean {
        val device = credentials.read() ?: return false
        return syncPendingLocations(device.deviceCode, device.secret)
    }

    private suspend fun syncPendingLocations(deviceCode: String, secret: String): Boolean {
        for (location in dao.pendingLocations()) {
            val payload = HeartbeatRequest(
                requestId = location.id,
                battery = batteryPercent(),
                latitude = location.latitude,
                longitude = location.longitude,
                accuracy = location.accuracy,
                networkStatus = "CONNECTED",
                monitoringStatus = if (isMonitoring) "ACTIVE" else "STOPPED",
                appVersion = appVersion(),
                firmwareVersion = Build.VERSION.RELEASE,
            )
            try {
                deviceApi(backendUrl).heartbeat(deviceCode, secret, payload)
                dao.deleteLocation(location.id)
            } catch (_: Exception) {
                return false
            }
        }
        return true
    }

    private suspend fun getLocation(): Location? = try {
        fusedLocation.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, CancellationTokenSource().token).await()
    } catch (_: SecurityException) {
        null
    } catch (_: Exception) {
        null
    }

    private fun hasLocationPermission() = ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    suspend fun currentLocation(): Location? = if (hasLocationPermission()) getLocation() else null

    private suspend fun configurationSnapshot(): DeviceConfiguration? = dao.configurationSnapshot()

    private fun appVersion(): String = try {
        appContext.packageManager.getPackageInfo(appContext.packageName, 0).versionName ?: "unknown"
    } catch (_: Exception) { "unknown" }

    private fun HeartbeatRequest.toPending(id: String) = PendingHeartbeat(
        id = id, battery = battery ?: -1, latitude = latitude, longitude = longitude, accuracy = accuracy,
        networkStatus = networkStatus, monitoringStatus = monitoringStatus, appVersion = appVersion,
        firmwareVersion = firmwareVersion, createdAt = System.currentTimeMillis(),
    )

    private fun PendingHeartbeat.toRequest() = HeartbeatRequest(
        requestId = id,
        battery = battery.takeIf { it in 0..100 }, latitude = latitude, longitude = longitude, accuracy = accuracy,
        networkStatus = networkStatus, monitoringStatus = monitoringStatus, appVersion = appVersion,
        firmwareVersion = firmwareVersion,
    )

    private companion object {
        const val KEY_URL = "backend_url"
        const val KEY_HEARTBEAT = "heartbeat_interval_minutes"
        const val KEY_GPS = "gps_interval_minutes"
        const val KEY_MONITORING = "monitoring_enabled"
        const val KEY_LAST_LAT = "last_latitude"
        const val KEY_LAST_LON = "last_longitude"
        const val KEY_LAST_ACCURACY = "last_accuracy"
        const val DEFAULT_HEARTBEAT_MINUTES = 5
        const val DEFAULT_GPS_MINUTES = 5
    }
}
