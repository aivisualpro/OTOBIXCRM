import { shallowRef } from 'vue'
import { deduplicatedFetch, QUERY_KEYS } from '~/composables/useQueryCache'

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
  // Shallow state for large dataset (rule 14)
  const _allUsers = useState<PeopleUser[]>('people_users', () => shallowRef([]) as any)
  const _isFetched = useState('people_isFetched', () => false)
  const _isFetching = useState('people_isFetching', () => false)
  const _isRefreshing = useState('people_isRefreshing', () => false)
  const _fetchError = useState<string | null>('people_fetchError', () => null)

  const { apiBaseUrl: _apiBaseUrl } = useApiEnvironment()
  const authToken = useCookie('authToken')

  function _headers(): Record<string, string> {
    return authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}
  }

  /**
   * Fetches ALL users from user/all-users-list.
   * Each tab (otobix / dealers / customers / kams) filters this list client-side.
   * SWR: Cached globally — shows stale data immediately, refreshes in background.
   */
  async function fetchAllUsers(force = false) {
    if (_isFetched.value && !force) return
    if (_isFetching.value && !force) return

    // SWR: If we have cached data and this is a forced refresh, don't block UI
    const hasCachedData = _allUsers.value.length > 0
    if (hasCachedData && force) {
      _isRefreshing.value = true
    }
    else {
      _isFetching.value = true
    }

    _fetchError.value = null

    try {
      const queryKey = QUERY_KEYS.users()
      const response = await deduplicatedFetch(queryKey, () => 
        $fetch<any>('/api/users', { method: 'GET' })
      )

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
      // Don't clear cached data on error — keep stale data visible
      if (!hasCachedData) {
        _allUsers.value = []
      }
    }
    finally {
      _isFetching.value = false
      _isRefreshing.value = false
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

    // Inject into local cache — reassign for shallow reactivity
    if (response?.data) {
      const newUser = { ...response.data, id: response.data._id || response.data.id }
      _allUsers.value = [newUser, ..._allUsers.value]
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

    // Optimistic removal — reassign for shallow reactivity
    _allUsers.value = _allUsers.value.filter(u => u.id !== userId && u._id !== userId)

    return response
  }

  /** Find a user by ID from the cached list */
  function getUserById(id: string): PeopleUser | undefined {
    return _allUsers.value.find(u => u.id === id || u._id === id)
  }

  return {
    allUsers: _allUsers,
    isLoading: _isFetching,
    isRefreshing: _isRefreshing,
    isFetched: _isFetched,
    fetchError: _fetchError,
    fetchAllUsers,
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserById,
  }
}
