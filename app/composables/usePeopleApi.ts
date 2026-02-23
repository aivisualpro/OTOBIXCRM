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

// ─── Global cache: fetch once, reuse across all People sub-routes ───
const _allUsers = ref<PeopleUser[]>([])
const _isFetched = ref(false)
const _isFetching = ref(false)
const _fetchError = ref<string | null>(null)

// ─── Separate cache for staff users (Otobix tab) ───
const _staffUsers = ref<PeopleUser[]>([])
const _isStaffFetched = ref(false)
const _isStaffFetching = ref(false)
const _staffFetchError = ref<string | null>(null)

export function usePeopleApi() {
  const { apiBaseUrl } = useApiEnvironment()
  const authToken = useCookie('authToken')

  function _headers(): Record<string, string> {
    return authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}
  }

  /** Fetch all users from the API (runs only once, cached globally) */
  async function fetchAllUsers(force = false) {
    if (_isFetched.value && !force)
      return
    if (_isFetching.value && !force)
      return

    _isFetching.value = true
    _fetchError.value = null

    try {
      const response = await $fetch<any>(
        `${apiBaseUrl.value}user/all-users-list`,
        { method: 'GET', headers: _headers() },
      )

      const usersArray = Array.isArray(response)
        ? response
        : response?.users || response?.data || []

      // Normalize: map _id → id
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
  /** Fetch staff users (isStaff=true) via direct MongoDB query through our server API */
  async function fetchStaffUsers(force = false) {
    if (_isStaffFetched.value && !force)
      return
    if (_isStaffFetching.value && !force)
      return

    _isStaffFetching.value = true
    _staffFetchError.value = null

    try {
      const response = await $fetch<any>('/api/staff-users')

      const usersArray = Array.isArray(response)
        ? response
        : response?.users || response?.data || []

      console.warn(`[People:Staff] Loaded ${usersArray.length} staff users from MongoDB`)

      _staffUsers.value = usersArray.map((item: any) => ({
        ...item,
        isStaff: true,
        id: item._id || item.id,
      }))

      _isStaffFetched.value = true
    }
    catch (err: any) {
      _staffFetchError.value = err?.data?.message || err?.message || 'Failed to fetch staff users'
      _staffUsers.value = []
    }
    finally {
      _isStaffFetching.value = false
    }
  }

  /** Force re-fetch all users */
  async function refreshUsers() {
    await fetchAllUsers(true)
  }

  /** Force re-fetch staff users */
  async function refreshStaffUsers() {
    await fetchStaffUsers(true)
  }

  async function createUser(payload: {
    userRole: string
    phoneNumber: string
    location: string | string[]
    userName: string
    email: string
    password: string
    addressList: string[]
    approvalStatus: string
    assignedKam: string
    isStaff: boolean
  }) {
    const body = {
      ...payload,
      location: Array.isArray(payload.location) ? payload.location.join(', ') : payload.location,
    }
    console.warn('[People] Creating user:', JSON.stringify(body))
    const response = await $fetch<any>(
      `${apiBaseUrl.value}admin/create-user-through-admin`,
      {
        method: 'POST',
        headers: _headers(),
        body,
      },
    )
    await Promise.all([refreshUsers(), refreshStaffUsers()])
    return response
  }

  /** Update user profile via PUT user/update-user-through-admin/?userId=<id> */
  async function updateUser(userId: string, payload: Partial<PeopleUser>) {
    const url = `${apiBaseUrl.value}user/update-user-through-admin`
    console.warn('[People:Update] PUT →', url, '?userId=', userId)
    console.warn('[People:Update] Body:', JSON.stringify(payload).slice(0, 500))

    const response = await $fetch<any>(url, {
      method: 'PUT',
      headers: _headers(),
      params: { userId },
      body: payload,
    })

    console.warn('[People:Update] Response:', JSON.stringify(response).slice(0, 300))

    // Refresh caches
    await Promise.all([refreshUsers(), refreshStaffUsers()])
    return response
  }

  /** Delete user via external API */
  async function deleteUser(userId: string) {
    const response = await $fetch<any>(
      `${apiBaseUrl.value}user/delete-profile`,
      {
        method: 'DELETE',
        headers: _headers(),
        body: { userId },
      },
    )
    // Refresh caches
    await Promise.all([refreshUsers(), refreshStaffUsers()])
    return response
  }

  /** Find a user by ID from cached lists */
  function getUserById(id: string): PeopleUser | undefined {
    return _allUsers.value.find(u => u.id === id || u._id === id)
      || _staffUsers.value.find(u => u.id === id || u._id === id)
  }

  return {
    allUsers: _allUsers,
    isLoading: _isFetching,
    isFetched: _isFetched,
    fetchError: _fetchError,
    fetchAllUsers,
    refreshUsers,
    // Staff-specific
    staffUsers: _staffUsers,
    isStaffLoading: _isStaffFetching,
    isStaffFetched: _isStaffFetched,
    staffFetchError: _staffFetchError,
    fetchStaffUsers,
    refreshStaffUsers,
    createUser,
    updateUser,
    deleteUser,
    getUserById,
  }
}
