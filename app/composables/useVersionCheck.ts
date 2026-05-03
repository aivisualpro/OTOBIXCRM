/**
 * ─── Version Check Composable ───
 *
 * Polls /api/version every 30s.
 * On first load, captures the build ID.
 * If a subsequent poll returns a different build ID → new deployment detected.
 * Exposes reactive state for a global update banner.
 */
export function useVersionCheck() {
  const _knownBuildId = useState<string>('version_knownBuildId', () => '')
  const _updateAvailable = useState<boolean>('version_updateAvailable', () => false)
  const _newBuildId = useState<string>('version_newBuildId', () => '')
  const _dismissed = useState<boolean>('version_dismissed', () => false)
  const _started = useState<boolean>('version_started', () => false)
  const _checking = useState<boolean>('version_checking', () => false)

  const POLL_INTERVAL = 30_000 // 30 seconds

  async function checkVersion() {
    if (!import.meta.client) return
    _checking.value = true
    try {
      const res = await $fetch<{ buildId: string }>(`/api/version?t=${Date.now()}`)
      if (!res?.buildId) return

      if (!_knownBuildId.value) {
        // First load — set baseline
        _knownBuildId.value = res.buildId
        return
      }

      if (res.buildId !== _knownBuildId.value) {
        _newBuildId.value = res.buildId
        _updateAvailable.value = true
        _dismissed.value = false
      }
    }
    catch {
      // Network error — ignore
    }
    finally {
      _checking.value = false
    }
  }

  function startPolling() {
    if (_started.value) return
    _started.value = true

    if (!import.meta.client) return

    // Initial check
    checkVersion()

    // Poll every POLL_INTERVAL
    setInterval(() => {
      checkVersion()
    }, POLL_INTERVAL)

    // Also check when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkVersion()
      }
    })
  }

  function dismissUpdate() {
    _dismissed.value = true
  }

  function applyUpdate() {
    if (import.meta.client) {
      window.location.reload()
    }
  }

  return {
    updateAvailable: computed(() => _updateAvailable.value && !_dismissed.value),
    isUpdateAvailable: _updateAvailable,
    dismissed: _dismissed,
    checking: _checking,
    startPolling,
    dismissUpdate,
    applyUpdate,
  }
}
