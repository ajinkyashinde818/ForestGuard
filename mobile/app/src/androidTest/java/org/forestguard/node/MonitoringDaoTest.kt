package org.forestguard.node

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import org.forestguard.node.data.database.MonitoringDatabase
import org.forestguard.node.data.database.PendingHeartbeat
import org.forestguard.node.data.database.PendingLocation
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MonitoringDaoTest {
    private val database = Room.inMemoryDatabaseBuilder(
        ApplicationProvider.getApplicationContext<Context>(),
        MonitoringDatabase::class.java,
    ).allowMainThreadQueries().build()

    @After fun closeDatabase() = database.close()

    @Test fun pendingHeartbeatAndLocationSurviveDatabaseRead() = runBlocking {
        val dao = database.dao()
        dao.insertHeartbeat(PendingHeartbeat("heartbeat-1", 79, 12.5, 77.2, 8.0, "DISCONNECTED", "ACTIVE", "2.0.0", "15", 100L))
        dao.insertLocation(PendingLocation("location-1", 12.5, 77.2, 8.0, 100L))

        assertEquals("heartbeat-1", dao.pendingHeartbeats().single().id)
        assertEquals(12.5, dao.pendingLocations().single().latitude, 0.0)
        dao.deleteHeartbeat("heartbeat-1")
        dao.deleteLocation("location-1")
        assertEquals(emptyList<PendingHeartbeat>(), dao.pendingHeartbeats())
        assertEquals(emptyList<PendingLocation>(), dao.pendingLocations())
    }
}
