export interface PeopleUser {
  [key: string]: any
  _id: string
  id: string
  userRole: string
  phoneNumber: string
  location: string
  userName: string
  email: string
  dealershipName: string
  image: string
  entityType: string
  isStaff: boolean
  primaryContactPerson: string
  primaryContactNumber: string
  secondaryContactPerson: string
  secondaryContactNumber: string
  addressList: string[]
  approvalStatus: string
  rejectionComment: string
  wishlist: string[]
  myBids: string[]
  purchasedCars: string[]
  assignedKam: string
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export function usePeopleApi() {
  // useState keyed calls — safe inside composable, shared across all callers via key
  const _allUsers = useState<PeopleUser[]>('people_users', () => [])
  const _isFetched = useState('people_isFetched', () => false)
  const _isFetching = useState('people_isFetching', () => false)
  const _fetchError = useState<string | null>('people_fetchError', () => null)

  const { apiBaseUrl: _apiBaseUrl } = useApiEnvironment()
  const authToken = useCookie('authToken')

  function _headers(): Record<string, string> {
    return authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}
  }

  /**
   * Fetches ALL users from user/all-users-list.
   * Each tab (otobix / dealers / customers / kams) filters this list client-side.
   * Cached globally — runs only once unless force=true.
   */
  async function fetchAllUsers(force = false) {
    if (_isFetched.value && !force)
      return
    if (_isFetching.value && !force)
      return

    _isFetching.value = true
    _fetchError.value = null

    try {
      const response = await $fetch<any>('/api/users', { method: 'GET' })

      const usersArray = Array.isArray(response)
        ? response
        : response?.users || response?.data || []

      _allUsers.value = usersArray.map((item: any) => ({
        ...item,
        id: item._id || item.id,
      }))

      _isFetched.value = true
    }
    catch (err: any) {
      _fetchError.value = err?.data?.message || err?.message || 'Failed to fetch users'
      _allUsers.value = []
    }
    finally {
      _isFetching.value = false
    }
  }

  /** Force re-fetch */
  async function refreshUsers() {
    await fetchAllUsers(true)
  }

  async function createUser(payload: {
    userRole: string
    phoneNumber: string
    location: string | string[]
    userName: string
    email: string
    password?: string
    addressList?: string[]
    approvalStatus?: string
    assignedKam?: string
    isStaff?: boolean
    dealershipName?: string
    entityType?: string
  }) {
    const response = await $fetch<any>('/api/users/add', {
      method: 'POST',
      body: payload,
    })

    // Inject the new user into the local cache immediately
    if (response?.data) {
      const newUser = { ...response.data, id: response.data._id || response.data.id }
      _allUsers.value.unshift(newUser)
    }

    return response
  }

  /** Update user profile — direct MongoDB update via local server route */
  async function updateUser(userId: string, payload: Partial<PeopleUser>) {
    // Normalise location: the API stores it as a comma-separated string
    const body: Record<string, any> = {
      ...payload,
      userId,
      location: Array.isArray(payload.location)
        ? payload.location.join(', ')
        : payload.location,
    }

    const response = await $fetch<any>(
      '/api/users/update',
      { method: 'PUT', body },
    )

    // Patch local cache directly. Do NOT call refreshUsers() here because the 
    // external API's GET endpoint aggressively strips sensitive fields like passwords, 
    // causing the UI to falsely appear as if the save failed!
    const idx = _allUsers.value.findIndex(u => u.id === userId || u._id === userId)
    if (idx !== -1 && _allUsers.value[idx]) {
      Object.assign(_allUsers.value[idx]!, payload)
      // Normalise location locally just like we did for the API
      _allUsers.value[idx]!.location = body.location
    }

    return response
  }

  /** Delete user — direct MongoDB via our own API */
  async function deleteUser(userId: string) {
    const response = await $fetch<any>(
      '/api/users/delete',
      { method: 'DELETE', body: { userId } },
    )
    await refreshUsers()
    return response
  }

  /** Find a user by ID from the cached list */
  function getUserById(id: string): PeopleUser | undefined {
    return _allUsers.value.find(u => u.id === id || u._id === id)
  }

  // ─── Quick Sync Engine (People) ───
  const _peopleLastTs = useState('people_lastKnownTs', () => 0)
  let _peopleInterval: ReturnType<typeof setInterval> | null = null

  async function _checkPeopleUpdates() {
    if (!_peopleLastTs.value)
      return
    try {
      const since = _peopleLastTs.value
      const res = await $fetch<{ users: any[], ts: number }>(`/api/users/delta?since=${since}&t=${Date.now()}`)
      if (res.users && res.users.length > 0) {
        const changedMap = new Map(res.users.map((u: any) => [String(u._id || u.id), u]))
        _allUsers.value = _allUsers.value.map((existing) => {
          const key = String(existing._id || existing.id)
          const updated = changedMap.get(key)
          if (updated) { changedMap.delete(key); return { ...updated, id: updated.id || updated._id } as PeopleUser }
          return existing
        })
        for (const [, u] of changedMap) {
          _allUsers.value.push({ ...u, id: u.id || u._id } as PeopleUser)
        }
      }
      _peopleLastTs.value = Math.max(res.ts || since, since)
    }
    catch { /* silent */ }
  }

  function startPeopleQuickSync() {
    if (_peopleInterval)
      return
    if (!_peopleLastTs.value)
      _peopleLastTs.value = Date.now()
    _peopleInterval = setInterval(_checkPeopleUpdates, 30000)
  }

  function stopPeopleQuickSync() {
    if (_peopleInterval) { clearInterval(_peopleInterval); _peopleInterval = null }
  }

  return {
    allUsers: _allUsers,
    isLoading: _isFetching,
    isFetched: _isFetched,
    fetchError: _fetchError,
    fetchAllUsers,
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserById,
    startQuickSync: startPeopleQuickSync,
    stopQuickSync: stopPeopleQuickSync,
  }
}
