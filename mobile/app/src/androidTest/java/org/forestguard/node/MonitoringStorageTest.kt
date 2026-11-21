package org.forestguard.node

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.forestguard.node.data.preferences.DeviceCredentials
import org.forestguard.node.data.preferences.SecureDeviceStore
import org.forestguard.node.data.database.MonitoringDatabase
import org.forestguard.node.data.repository.MonitoringRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MonitoringStorageTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test fun encryptedStoreRoundTripsCredentialsWithoutPlaintextPreferences() {
        val store = SecureDeviceStore(context)
        val credentials = DeviceCredentials("FG-TEST-1", "very-secret-demo-token")
        try {
            store.save(credentials)
            assertEquals(credentials, store.read())
            val persisted = context.getSharedPreferences("device_credentials_encrypted", 0).all.values.joinToString()
            assertFalse(persisted.contains(credentials.deviceCode))
            assertFalse(persisted.contains(credentials.secret))
        } finally {
            store.clear()
        }
    }

    @Test fun settingsAndMonitoringStateAreValidatedAndPersisted() = runBlocking {
        val repository = MonitoringRepository(context)
        repository.setMonitoring(false)
        repository.updateSettings("https://forest.example/api", 4, 7)
        assertEquals(4, repository.heartbeatIntervalMinutes)
        assertEquals(7, repository.gpsIntervalMinutes)
        assertEquals("https://forest.example/api/", repository.backendUrl)
        assertThrows(IllegalArgumentException::class.java) {
            runBlocking { repository.updateSettings("https://forest.example/api/", 0, 7) }
        }
        repository.setMonitoring(true)
        assertEquals(true, repository.isMonitoring)
        repository.setMonitoring(false)
    }

    @Test fun unavailableBackendKeepsHeartbeatInRoomForRetry() = runBlocking {
        val repository = MonitoringRepository(context)
        val dao = MonitoringDatabase.get(context).dao()
        val credentialStore = SecureDeviceStore(context)
        val previousIds = dao.pendingHeartbeats().map { it.id }.toSet()
        try {
            credentialStore.save(DeviceCredentials("FG-OFFLINE-TEST", "test-only-device-secret"))
            repository.updateSettings("http://10.0.2.2:1/api/", 1, 1)
            repository.setMonitoring(true)
            assertFalse(repository.captureAndSendHeartbeat(forceLocation = false))

            val queued = dao.pendingHeartbeats().filterNot { it.id in previousIds }
            assertEquals(1, queued.size)
            assertEquals("ACTIVE", queued.single().monitoringStatus)
        } finally {
            dao.pendingHeartbeats().filterNot { it.id in previousIds }.forEach { dao.deleteHeartbeat(it.id) }
            credentialStore.clear()
            repository.setMonitoring(false)
            repository.updateSettings(org.forestguard.node.BuildConfig.API_BASE_URL, 5, 5)
        }
    }
}
