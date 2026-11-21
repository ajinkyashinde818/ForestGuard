package org.forestguard.node.data.repository

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ConnectivityMonitor(context: Context) {
    private val manager = context.getSystemService(ConnectivityManager::class.java)
    private val mutableState = MutableStateFlow(readState())
    val state: StateFlow<ConnectionState> = mutableState.asStateFlow()
    private var registered = false

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { mutableState.value = ConnectionState.CONNECTING }
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
            mutableState.value = if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) ConnectionState.ONLINE else ConnectionState.CONNECTING
        }
        override fun onLost(network: Network) { mutableState.value = readState() }
    }

    @Synchronized fun start() {
        if (registered) return
        manager.registerNetworkCallback(NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(), callback)
        registered = true
        mutableState.value = readState()
    }

    @Synchronized fun stop() {
        if (!registered) return
        runCatching { manager.unregisterNetworkCallback(callback) }
        registered = false
    }

    private fun readState(): ConnectionState {
        val network = manager.activeNetwork ?: return ConnectionState.OFFLINE
        val capabilities = manager.getNetworkCapabilities(network) ?: return ConnectionState.OFFLINE
        return if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) ConnectionState.ONLINE else ConnectionState.CONNECTING
    }
}
