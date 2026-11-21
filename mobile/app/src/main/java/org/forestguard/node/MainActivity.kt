package org.forestguard.node

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import org.forestguard.node.data.repository.ConnectionState
import org.forestguard.node.ui.NodeUiState
import org.forestguard.node.ui.NodeViewModel
import org.forestguard.node.ui.NodeViewModelFactory
import java.text.DateFormat
import java.util.Date

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repository = (application as ForestGuardApplication).repository
        setContent {
            val nodeViewModel: NodeViewModel = viewModel(factory = NodeViewModelFactory(application, repository))
            ForestGuardNodeApp(nodeViewModel)
        }
    }
}

@Composable
private fun ForestGuardNodeApp(viewModel: NodeViewModel) {
    val state by viewModel.state.collectAsState()
    var deviceCode by remember { mutableStateOf("") }
    var deviceSecret by remember { mutableStateOf("") }
    var backendUrl by remember(state.backendUrl) { mutableStateOf(state.backendUrl) }
    var heartbeatMinutes by remember(state.heartbeatMinutes) { mutableStateOf(state.heartbeatMinutes.toString()) }
    var gpsMinutes by remember(state.gpsMinutes) { mutableStateOf(state.gpsMinutes.toString()) }
    var showPairing by remember { mutableStateOf(false) }
    var showPermissionDisclosure by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val requiredPermissions = remember {
        buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }.toTypedArray()
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
        val locationGranted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true || grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val notificationsGranted = Build.VERSION.SDK_INT < 33 || grants[Manifest.permission.POST_NOTIFICATIONS] == true ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (locationGranted && notificationsGranted) viewModel.startMonitoring() else viewModel.permissionDenied()
    }

    MaterialTheme(colorScheme = lightColorScheme(primary = androidx.compose.ui.graphics.Color(0xFF1E593C))) {
        Scaffold { padding ->
            Column(
                Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text("ForestGuard Monitoring", style = MaterialTheme.typography.headlineMedium)
                Text("A field node for location and device-health reporting.", style = MaterialTheme.typography.bodyMedium)
                if (!state.paired || showPairing) {
                    PairingCard(
                        deviceCode = deviceCode,
                        onDeviceCode = { deviceCode = it },
                        secret = deviceSecret,
                        onSecret = { deviceSecret = it },
                        backendUrl = backendUrl,
                        onBackendUrl = { backendUrl = it },
                        busy = state.busy,
                        onPair = { viewModel.pair(deviceCode, deviceSecret, backendUrl); deviceSecret = ""; showPairing = false },
                    )
                }
                NodeDashboard(state)
                if (state.paired && !showPairing) {
                    OutlinedButton(onClick = { showPairing = true }, modifier = Modifier.fillMaxWidth()) { Text("RE-PAIR / REPLACE DEVICE CREDENTIALS") }
                }
                SettingsCard(
                    backendUrl = backendUrl,
                    onBackendUrl = { backendUrl = it },
                    heartbeatMinutes = heartbeatMinutes,
                    onHeartbeatMinutes = { heartbeatMinutes = it },
                    gpsMinutes = gpsMinutes,
                    onGpsMinutes = { gpsMinutes = it },
                    onSave = { viewModel.saveSettings(backendUrl, heartbeatMinutes, gpsMinutes) },
                )
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Monitoring controls", style = MaterialTheme.typography.titleMedium)
                        Text("Location is used to place device heartbeats. An ongoing notification shows monitoring status. Microphone permission is not requested and audio is not recorded in this milestone.")
                        if (state.monitoring) {
                            OutlinedButton(onClick = viewModel::stopMonitoring, modifier = Modifier.fillMaxWidth()) { Text("STOP MONITORING") }
                        } else {
                            Button(
                                onClick = { if (state.paired) showPermissionDisclosure = true },
                                enabled = state.paired && !state.busy,
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text("START MONITORING") }
                        }
                    }
                }
                state.error?.let { ErrorCard(it) {
                    viewModel.openAppSettings()
                } }
                state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
                if (state.busy) CircularProgressIndicator()
                Text("Possible event reporting is advisory. No acoustic classification or illegal-activity determination is performed on this device.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }

    if (showPermissionDisclosure) {
        AlertDialog(
            onDismissRequest = { showPermissionDisclosure = false },
            title = { Text("Allow monitoring permissions") },
            text = { Text("ForestGuard needs location access to attach real GPS coordinates to device health updates. Notifications keep the foreground monitoring service visible while it runs. This milestone does not record audio.") },
            confirmButton = {
                TextButton(onClick = {
                    showPermissionDisclosure = false
                    permissionLauncher.launch(requiredPermissions)
                }) { Text("Continue") }
            },
            dismissButton = { TextButton(onClick = { showPermissionDisclosure = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun PairingCard(
    deviceCode: String,
    onDeviceCode: (String) -> Unit,
    secret: String,
    onSecret: (String) -> Unit,
    backendUrl: String,
    onBackendUrl: (String) -> Unit,
    busy: Boolean,
    onPair: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Pair this monitoring device", style = MaterialTheme.typography.titleMedium)
            Text("An administrator must register this device first. Enter the returned device ID and one-time device secret. Credentials are verified with the existing device authentication API and stored encrypted using Android Keystore.")
            OutlinedTextField(deviceCode, onDeviceCode, label = { Text("Device ID (FG-…)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(secret, onSecret, label = { Text("One-time device secret") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
            OutlinedTextField(backendUrl, onBackendUrl, label = { Text("Backend URL ending in /api/") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Button(onClick = onPair, enabled = !busy && deviceCode.isNotBlank() && secret.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("VERIFY AND PAIR") }
        }
    }
}

@Composable
private fun NodeDashboard(state: NodeUiState) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(state.deviceName.ifBlank { "Device status" }, style = MaterialTheme.typography.titleMedium)
            StatusRow("Device", if (state.paired) state.deviceCode else "Not paired")
            StatusRow("Status", if (state.paired) state.deviceStatus else "OFFLINE")
            StatusRow("Monitoring", if (state.monitoring) "ACTIVE" else "STOPPED")
            StatusRow("GPS", if (state.gpsAvailable) "Available" else "Unavailable")
            StatusRow("Latitude", state.latitude?.toString() ?: "Not reported")
            StatusRow("Longitude", state.longitude?.toString() ?: "Not reported")
            StatusRow("Battery", state.battery?.let { "$it%" } ?: "Unavailable")
            StatusRow("Network", when (state.connection) {
                ConnectionState.ONLINE -> "Connected"
                ConnectionState.CONNECTING -> "Connecting"
                ConnectionState.OFFLINE -> "Offline"
                ConnectionState.ERROR -> "Error"
            })
            StatusRow("Last sync", state.lastSync?.let { DateFormat.getDateTimeInstance().format(Date(it)) } ?: "Not synced")
            StatusRow("Queued heartbeats", state.pendingCount.toString())
            StatusRow("App version", BuildConfig.VERSION_NAME)
        }
    }
}

@Composable
private fun SettingsCard(
    backendUrl: String,
    onBackendUrl: (String) -> Unit,
    heartbeatMinutes: String,
    onHeartbeatMinutes: (String) -> Unit,
    gpsMinutes: String,
    onGpsMinutes: (String) -> Unit,
    onSave: () -> Unit,
) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Device settings", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(backendUrl, onBackendUrl, label = { Text("Backend URL") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(heartbeatMinutes, onHeartbeatMinutes, label = { Text("Heartbeat (minutes)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
                OutlinedTextField(gpsMinutes, onGpsMinutes, label = { Text("GPS (minutes)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.weight(1f))
            }
            Button(onClick = onSave, modifier = Modifier.fillMaxWidth()) { Text("SAVE SETTINGS") }
        }
    }
}

@Composable
private fun ErrorCard(message: String, onOpenSettings: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(message, color = MaterialTheme.colorScheme.error)
            TextButton(onClick = onOpenSettings) { Text("Open Android app settings") }
        }
    }
}

@Composable
private fun StatusRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium)
        Text(value, style = MaterialTheme.typography.bodySmall)
    }
}
