package org.forestguard.node.worker

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.forestguard.node.ForestGuardApplication
import java.util.concurrent.TimeUnit

class HeartbeatWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        return try {
            val repository = (applicationContext as ForestGuardApplication).repository
            if (!repository.isMonitoring) return Result.success()
            if (!repository.syncPendingHeartbeats()) return Result.retry()
            if (repository.captureAndSendHeartbeat(forceLocation = true)) Result.success() else Result.retry()
        } catch (_: Exception) { Result.retry() }
    }

    companion object { const val UNIQUE_NAME = "forestguard-periodic-heartbeat" }
}

class LocationSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        return try {
            val repository = (applicationContext as ForestGuardApplication).repository
            if (repository.syncPendingLocations()) Result.success() else Result.retry()
        } catch (_: Exception) { Result.retry() }
    }
}

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        return try {
            val repository = (applicationContext as ForestGuardApplication).repository
            if (repository.syncPendingHeartbeats()) Result.success() else Result.retry()
        } catch (_: Exception) { Result.retry() }
    }
}

object MonitoringWorkScheduler {
    fun enqueueSync(context: Context) {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        val locations = OneTimeWorkRequestBuilder<LocationSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .beginUniqueWork("forestguard-offline-sync", ExistingWorkPolicy.KEEP, request)
            .then(locations)
            .enqueue()

    }
}
