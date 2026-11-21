package org.forestguard.node.ui

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.forestguard.node.ForestGuardApplication
import org.forestguard.node.data.repository.ConnectionState
import org.forestguard.node.data.repository.MonitoringRepository
import org.forestguard.node.service.MonitoringForegroundService
import org.forestguard.node.worker.MonitoringWorkScheduler
import retrofit2.HttpException
import java.io.IOException

data class NodeUiState(
    val paired: Boolean = false,
    val deviceCode: String = "",
    val deviceName: String = "",
    val deviceStatus: String = "OFFLINE",
    val monitoring: Boolean = false,
    val connection: ConnectionState = ConnectionState.OFFLINE,
    val gpsAvailable: Boolean = false,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val battery: Int? = null,
    val lastSync: Long? = null,
    val pendingCount: Int = 0,
    val backendUrl: String = "",
    val heartbeatMinutes: Int = 5,
    val gpsMinutes: Int = 5,
    val busy: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

class NodeViewModel(application: Application, private val repository: MonitoringRepository) : AndroidViewModel(application) {
    private val mutableState = MutableStateFlow(
        NodeUiState(
            paired = repository.deviceCredentials() != null,
            monitoring = repository.isMonitoring,
            backendUrl = repository.backendUrl,
            heartbeatMinutes = repository.heartbeatIntervalMinutes,
            gpsMinutes = repository.gpsIntervalMinutes,
            battery = repository.batteryPercent(),
            latitude = repository.lastKnownCoordinates?.first,
            longitude = repository.lastKnownCoordinates?.second,
            gpsAvailable = repository.lastKnownCoordinates != null,
        ),
    )
    val state = mutableState.asStateFlow()

    init {
        val app = application as ForestGuardApplication
        viewModelScope.launch {
            repository.configuration.collectLatest { config ->
                mutableState.update { current -> current.copy(
                    paired = config != null && repository.deviceCredentials() != null,
                    deviceCode = config?.deviceCode.orEmpty(),
                    deviceName = config?.deviceName.orEmpty(),
                    deviceStatus = config?.let(::statusFor) ?: "OFFLINE",
                    monitoring = config?.monitoringEnabled ?: repository.isMonitoring,
                    backendUrl = config?.backendUrl ?: repository.backendUrl,
                    heartbeatMinutes = config?.heartbeatIntervalMinutes ?: repository.heartbeatIntervalMinutes,
                    gpsMinutes = config?.gpsIntervalMinutes ?: repository.gpsIntervalMinutes,
                    lastSync = config?.lastSyncedAt,
                ) }
            }
        }
        viewModelScope.launch { app.connectivity.state.collectLatest { connection -> mutableState.update { it.copy(connection = connection) } } }
        viewModelScope.launch {
            combine(repository.pendingHeartbeatCount, repository.pendingLocationCount) { heartbeats, locations -> heartbeats + locations }
                .collectLatest { count -> mutableState.update { it.copy(pendingCount = count) } }
        }
        refreshDeviceHealth()
    }

    fun pair(deviceCode: String, secret: String, backendUrl: String) = viewModelScope.launch {
        mutableState.update { it.copy(busy = true, error = null, message = null) }
        try {
            val config = repository.pair(deviceCode, secret, backendUrl)
            mutableState.update { it.copy(busy = false, paired = true, deviceCode = config.deviceCode, deviceName = config.deviceName, deviceStatus = config.statusFromMonitoring(), message = "Device paired securely.") }
        } catch (error: Exception) {
            mutableState.update { it.copy(busy = false, paired = false, error = describeError(error, "pair")) }
        }
    }

    fun saveSettings(url: String, heartbeat: String, gps: String) = viewModelScope.launch {
        mutableState.update { it.copy(error = null, message = null) }
        try {
            repository.updateSettings(url, heartbeat.toInt(), gps.toInt())
            mutableState.update { it.copy(backendUrl = repository.backendUrl, heartbeatMinutes = repository.heartbeatIntervalMinutes, gpsMinutes = repository.gpsIntervalMinutes, message = "Settings saved.") }
        } catch (error: Exception) {
            mutableState.update { it.copy(error = error.message ?: "Settings could not be saved.") }
        }
    }

    fun startMonitoring() = viewModelScope.launch {
        if (repository.deviceCredentials() == null) {
            mutableState.update { it.copy(error = "Pair this phone with an administrator-provisioned device before monitoring.") }
            return@launch
        }
        try {
            repository.setMonitoring(true)
            MonitoringForegroundService.start(getApplication())
            MonitoringWorkScheduler.enqueueSync(getApplication())
        } catch (error: Exception) {
            repository.setMonitoring(false)
            mutableState.update { it.copy(error = error.message ?: "Android could not start the monitoring foreground service.") }
            return@launch
        }
        mutableState.update { it.copy(monitoring = true, deviceStatus = "ONLINE", error = null, message = "Monitoring started. GPS and heartbeat are active; audio recording is not enabled.") }
        repository.captureAndSendHeartbeat(forceLocation = true)
        refreshDeviceHealth()
    }

    fun stopMonitoring() = viewModelScope.launch {
        repository.setMonitoring(false)
        repository.captureAndSendHeartbeat(forceLocation = false)
        MonitoringWorkScheduler.enqueueSync(getApplication())
        MonitoringForegroundService.stop(getApplication())
        mutableState.update { it.copy(monitoring = false, deviceStatus = "OFFLINE", message = "Monitoring stopped. No microphone audio was recorded.") }
        refreshDeviceHealth()
    }

    fun permissionDenied() {
        mutableState.update { it.copy(error = "Location and notification permissions are required to run monitoring. You can allow them in Android App settings and retry.") }
    }

    fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${getApplication<Application>().packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        getApplication<Application>().startActivity(intent)
    }

    fun clearMessages() = mutableState.update { it.copy(error = null, message = null) }

    private fun refreshDeviceHealth() = viewModelScope.launch {
        mutableState.update { it.copy(battery = repository.batteryPercent(), latitude = repository.lastKnownCoordinates?.first, longitude = repository.lastKnownCoordinates?.second, gpsAvailable = repository.lastKnownCoordinates != null) }
        val location = repository.currentLocation()
        if (location != null) mutableState.update { it.copy(latitude = location.latitude, longitude = location.longitude, gpsAvailable = true) }
    }

    private fun describeError(error: Exception, operation: String): String = when (error) {
        is HttpException -> when (error.code()) {
            401 -> "Device ID or one-time secret was rejected. It may have been rotated; ask an administrator to provision the device again."
            404 -> "The device API was not found. Check that the backend URL ends with /api/."
            else -> "Backend rejected the $operation request (${error.code()})."
        }
        is IOException -> "Cannot reach the ForestGuard backend. Check the URL and network, then retry."
        else -> error.message ?: "The $operation request failed."
    }

    private fun statusFor(config: org.forestguard.node.data.database.DeviceConfiguration): String = when {
        !config.monitoringEnabled -> "OFFLINE"
        config.lastSyncedAt == null -> "CONNECTING"
        System.currentTimeMillis() - config.lastSyncedAt > 10 * 60_000L -> "OFFLINE"
        else -> "ONLINE"
    }

    private fun org.forestguard.node.data.database.DeviceConfiguration.statusFromMonitoring() = if (monitoringEnabled) "ONLINE" else "OFFLINE"
}
