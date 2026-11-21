package org.forestguard.node.ui

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import org.forestguard.node.data.repository.MonitoringRepository

class NodeViewModelFactory(
    private val application: Application,
    private val repository: MonitoringRepository,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass.isAssignableFrom(NodeViewModel::class.java))
        return NodeViewModel(application, repository) as T
    }
}
