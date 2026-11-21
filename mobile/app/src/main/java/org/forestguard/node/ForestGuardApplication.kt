package org.forestguard.node

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.forestguard.node.data.repository.ConnectivityMonitor
import org.forestguard.node.data.repository.MonitoringRepository
import org.forestguard.node.worker.HeartbeatWorker
import java.util.concurrent.TimeUnit

class ForestGuardApplication : Application() {
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    lateinit var repository: MonitoringRepository
        private set
    lateinit var connectivity: ConnectivityMonitor
        private set

    override fun onCreate() {
        super.onCreate()
        repository = MonitoringRepository(this)
        connectivity = ConnectivityMonitor(this).also { it.start() }
        createNotificationChannel()
        val heartbeat = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            HeartbeatWorker.UNIQUE_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            heartbeat,
        )
        applicationScope.launch {
            if (repository.hasPendingData()) org.forestguard.node.worker.MonitoringWorkScheduler.enqueueSync(this@ForestGuardApplication)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ForestGuard monitoring",
                NotificationManager.IMPORTANCE_LOW,
            ).apply { description = "Status while this phone is actively monitoring as a ForestGuard node" }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    companion object { const val CHANNEL_ID = "forestguard_monitoring" }
}
