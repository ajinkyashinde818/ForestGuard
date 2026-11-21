package org.forestguard.node

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.work.ListenableWorker
import androidx.work.ExperimentalWorkManagerApi
import androidx.work.testing.TestListenableWorkerBuilder
import kotlinx.coroutines.runBlocking
import org.forestguard.node.worker.HeartbeatWorker
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalWorkManagerApi::class)
class MonitoringWorkerTest {
    @Test fun periodicHeartbeatDoesNothingWhenMonitoringIsStopped() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<ForestGuardApplication>()
        context.repository.setMonitoring(false)
        val worker = TestListenableWorkerBuilder<HeartbeatWorker>(context).build()
        assertEquals(ListenableWorker.Result.success(), worker.doWork())
    }
}
