package org.forestguard.node

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { ForestGuardNodeApp() } }
}

@Composable
fun ForestGuardNodeApp() {
    var monitoring by remember { mutableStateOf(false) }
    MaterialTheme(colorScheme = lightColorScheme(primary = androidx.compose.ui.graphics.Color(0xFF1E593C))) {
        Scaffold { padding -> Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement=Arrangement.spacedBy(16.dp)) {
            Text("ForestGuard Node", style=MaterialTheme.typography.headlineMedium)
            Text("Smartphone monitoring node", style=MaterialTheme.typography.bodyMedium)
            Card { Column(Modifier.padding(18.dp), verticalArrangement=Arrangement.spacedBy(8.dp)) { Text("Node not paired", style=MaterialTheme.typography.titleMedium); Text("Pair this phone through the administrator dashboard before field use.") } }
            Card { Column(Modifier.padding(18.dp), verticalArrangement=Arrangement.spacedBy(8.dp)) { Text("Monitoring", style=MaterialTheme.typography.titleMedium); Text(if(monitoring) "Active session" else "Stopped"); Button(onClick={monitoring=!monitoring}, enabled=false, modifier=Modifier.fillMaxWidth()) { Text(if(monitoring) "Stop monitoring" else "Start monitoring") }; Text("Microphone capture is not enabled in this build. The start control remains disabled until explicit consent, foreground service support, and secure device pairing are implemented.", style=MaterialTheme.typography.bodySmall) } }
            Card { Column(Modifier.padding(18.dp), verticalArrangement=Arrangement.spacedBy(8.dp)) { Text("Device status", style=MaterialTheme.typography.titleMedium); StatusRow("Location", "Permission not requested"); StatusRow("Network", "Not connected"); StatusRow("Battery", "Available on device") } }
            Card { Column(Modifier.padding(18.dp), verticalArrangement=Arrangement.spacedBy(8.dp)) { Text("Pending synchronization", style=MaterialTheme.typography.titleMedium); Text("No local event queue configured yet.") } }
            Text("Only selected short clips should be uploaded. Possible sound classifications need human review and are not proof of illegal activity.", style=MaterialTheme.typography.bodySmall)
        } }
    }
}

@Composable private fun StatusRow(label:String,value:String){Row(Modifier.fillMaxWidth(), verticalAlignment=Alignment.CenterVertically){Text(label,Modifier.weight(1f));Text(value,style=MaterialTheme.typography.bodySmall)}}
