/**
 * ─── Version Check Composable ───
 *
 * Polls /api/version every 30s.
 * On first load, captures the build ID.
 * If a subsequent poll returns a different build ID → new deployment detected.
 * Exposes reactive state for a global update banner.
 *
 * Fix: once the user dismisses the banner for a given buildId, it stays
 * dismissed for that build (no re-show on subsequent polls).
 */
export function useVersionCheck() {
  const _knownBuildId = useState<string>('version_knownBuildId', () => '')
  const _updateAvailable = useState<boolean>('version_updateAvailable', () => false)
  const _newBuildId = useState<string>('version_newBuildId', () => '')
  /** Stores the buildId the user dismissed, so we never re-show for the same build */
  const _dismissedBuildId = useState<string>('version_dismissedBuildId', () => '')
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
        // Do NOT reset dismissed — if user already dismissed this exact build, keep it dismissed
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
    // Remember which build was dismissed so it doesn't come back
    _dismissedBuildId.value = _newBuildId.value
  }

  function applyUpdate() {
    if (import.meta.client) {
      window.location.reload()
    }
  }

  return {
    // Show the banner only when there's an update AND it hasn't been dismissed for this build
    updateAvailable: computed(() =>
      _updateAvailable.value && _dismissedBuildId.value !== _newBuildId.value,
    ),
    isUpdateAvailable: _updateAvailable,
    dismissed: computed(() => _dismissedBuildId.value === _newBuildId.value),
    checking: _checking,
    startPolling,
    dismissUpdate,
    applyUpdate,
  }
}
