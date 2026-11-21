package org.forestguard.node.data.database

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "pending_heartbeats")
data class PendingHeartbeat(
    @PrimaryKey val id: String,
    val battery: Int,
    val latitude: Double?,
    val longitude: Double?,
    val accuracy: Double?,
    val networkStatus: String,
    val monitoringStatus: String,
    val appVersion: String,
    val firmwareVersion: String,
    val createdAt: Long,
)

@Entity(tableName = "pending_locations")
data class PendingLocation(
    @PrimaryKey val id: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Double,
    val capturedAt: Long,
)

@Entity(tableName = "pending_events")
data class PendingEvent(
    @PrimaryKey val idempotencyKey: String,
    val eventType: String,
    val occurredAt: Long,
    val latitude: Double?,
    val longitude: Double?,
    val description: String?,
)

@Entity(tableName = "device_configuration")
data class DeviceConfiguration(
    @PrimaryKey val id: Int = 1,
    val deviceCode: String,
    val deviceName: String,
    val backendUrl: String,
    val heartbeatIntervalMinutes: Int,
    val gpsIntervalMinutes: Int,
    val monitoringEnabled: Boolean,
    val lastSyncedAt: Long?,
)

@Dao
interface MonitoringDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHeartbeat(heartbeat: PendingHeartbeat)

    @Query("SELECT * FROM pending_heartbeats ORDER BY createdAt ASC")
    suspend fun pendingHeartbeats(): List<PendingHeartbeat>

    @Query("DELETE FROM pending_heartbeats WHERE id = :id")
    suspend fun deleteHeartbeat(id: String)

    @Query("SELECT COUNT(*) FROM pending_heartbeats")
    fun pendingHeartbeatCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM pending_locations")
    fun pendingLocationCount(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLocation(location: PendingLocation)

    @Query("SELECT * FROM pending_locations ORDER BY capturedAt ASC")
    suspend fun pendingLocations(): List<PendingLocation>

    @Query("DELETE FROM pending_locations WHERE id = :id")
    suspend fun deleteLocation(id: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvent(event: PendingEvent)

    @Query("SELECT * FROM pending_events ORDER BY occurredAt ASC")
    suspend fun pendingEvents(): List<PendingEvent>

    @Query("SELECT * FROM device_configuration WHERE id = 1")
    fun configuration(): Flow<DeviceConfiguration?>

    @Query("SELECT * FROM device_configuration WHERE id = 1")
    suspend fun configurationSnapshot(): DeviceConfiguration?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConfiguration(configuration: DeviceConfiguration)
}

@Database(
    entities = [PendingHeartbeat::class, PendingLocation::class, PendingEvent::class, DeviceConfiguration::class],
    version = 1,
    exportSchema = false,
)
abstract class MonitoringDatabase : RoomDatabase() {
    abstract fun dao(): MonitoringDao

    companion object {
        @Volatile private var instance: MonitoringDatabase? = null
        fun get(context: Context): MonitoringDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                MonitoringDatabase::class.java,
                "forestguard-monitoring.db",
            ).build().also { instance = it }
        }
    }
}
