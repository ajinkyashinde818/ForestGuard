package org.forestguard.node

import org.forestguard.node.data.api.ensureApiBaseUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class DeviceApiTest {
    @Test fun acceptsHttpsBackendAndAddsTrailingSlash() {
        assertEquals("https://forest.example/api/", "https://forest.example/api".ensureApiBaseUrl())
    }

    @Test fun acceptsAndroidEmulatorDevelopmentHost() {
        assertEquals("http://10.0.2.2:3000/api/", "http://10.0.2.2:3000/api/".ensureApiBaseUrl())
    }

    @Test fun rejectsCleartextRemoteBackend() {
        assertThrows(IllegalArgumentException::class.java) { "http://forest.example/api/".ensureApiBaseUrl() }
    }

    @Test fun rejectsSimilarButUntrustedEmulatorHost() {
        assertThrows(IllegalArgumentException::class.java) { "http://10.0.2.2.attacker.example/api/".ensureApiBaseUrl() }
    }

    @Test fun rejectsBackendUrlWithoutApiPrefix() {
        assertThrows(IllegalArgumentException::class.java) { "https://forest.example/".ensureApiBaseUrl() }
    }
}
