package org.forestguard.node.service

import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.forestguard.node.ForestGuardApplication
import org.forestguard.node.MainActivity
import org.forestguard.node.data.repository.MonitoringRepository
import org.forestguard.node.worker.MonitoringWorkScheduler

class MonitoringForegroundService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var monitoringJob: Job? = null
    private lateinit var repository: MonitoringRepository
    private var lastGpsAt = 0L

    override fun onCreate() {
        super.onCreate()
        repository = (application as ForestGuardApplication).repository
        promoteToForeground()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                monitoringJob?.cancel()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf(startId)
                return START_NOT_STICKY
            }
            else -> startMonitoringLoop()
        }
        return START_STICKY
    }

    private fun startMonitoringLoop() {
        if (monitoringJob?.isActive == true) return
        monitoringJob = scope.launch {
            while (isActive && repository.isMonitoring) {
                try {
                    val now = System.currentTimeMillis()
                    val gpsInterval = repository.gpsIntervalMinutes * 60_000L
                    val collectGps = lastGpsAt == 0L || now - lastGpsAt >= gpsInterval
                    if (collectGps) lastGpsAt = now
                    repository.captureAndSendHeartbeat(forceLocation = collectGps)
                    refreshNotification()
                    if (repository.hasPendingData()) MonitoringWorkScheduler.enqueueSync(this@MonitoringForegroundService)
                } catch (error: Exception) {
                    Log.w(TAG, "Monitoring cycle failed (${error.javaClass.simpleName}); the next cycle will retry")
                    runCatching { refreshNotification() }
                }
                val delayMs = minOf(repository.heartbeatIntervalMinutes, repository.gpsIntervalMinutes) * 60_000L
                delay(delayMs.coerceAtLeast(60_000L))
            }
            if (!repository.isMonitoring) stopSelf()
        }
    }

    private fun promoteToForeground() {
        val notification = buildNotification("Starting device health monitoring")
        val serviceType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, serviceType)
    }

    private suspend fun refreshNotification() {
        val network = if (repository.isNetworkConnected()) "Connected" else "Offline; sync queued"
        val gps = if (repository.lastKnownCoordinates != null) "Available" else "Unavailable"
        val battery = repository.batteryPercent()?.let { "$it%" } ?: "Unknown"
        val manager = getSystemService(android.app.NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification("GPS: $gps · Network: $network · Battery: $battery"))
    }

    private fun buildNotification(status: String) = NotificationCompat.Builder(this, ForestGuardApplication.CHANNEL_ID)
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setContentTitle("ForestGuard Monitoring Active")
        .setContentText(status)
        .setContentIntent(PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .build()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        monitoringJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val NOTIFICATION_ID = 2101
        private const val TAG = "ForestGuardNode"
        const val ACTION_START = "org.forestguard.node.action.START_MONITORING"
        const val ACTION_STOP = "org.forestguard.node.action.STOP_MONITORING"

        fun start(context: android.content.Context) {
            val intent = Intent(context, MonitoringForegroundService::class.java).setAction(ACTION_START)
            androidx.core.content.ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: android.content.Context) {
            context.startService(Intent(context, MonitoringForegroundService::class.java).setAction(ACTION_STOP))
        }
    }
}
