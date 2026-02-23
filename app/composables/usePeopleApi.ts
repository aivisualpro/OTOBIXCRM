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

// ─── Global cache: single fetch, reused across all People sub-routes ───
const _allUsers = ref<PeopleUser[]>([])
const _isFetched = ref(false)
const _isFetching = ref(false)
const _fetchError = ref<string | null>(null)

export function usePeopleApi() {
  const { apiBaseUrl } = useApiEnvironment()
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
      const response = await $fetch<any>(
        `${apiBaseUrl.value}user/all-users-list`,
        { method: 'GET', headers: _headers() },
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
    const response = await $fetch<any>(
      `${apiBaseUrl.value}admin/create-user-through-admin`,
      { method: 'POST', headers: _headers(), body },
    )
    await refreshUsers()
    return response
  }

  /** Update user profile */
  async function updateUser(userId: string, payload: Partial<PeopleUser>) {
    const response = await $fetch<any>(
      `${apiBaseUrl.value}user/update-user-through-admin`,
      { method: 'PUT', headers: _headers(), params: { userId }, body: payload },
    )
    await refreshUsers()
    return response
  }

  /** Delete user */
  async function deleteUser(userId: string) {
    const response = await $fetch<any>(
      `${apiBaseUrl.value}user/delete-profile`,
      { method: 'DELETE', headers: _headers(), body: { userId } },
    )
    await refreshUsers()
    return response
  }

  /** Find a user by ID from the cached list */
  function getUserById(id: string): PeopleUser | undefined {
    return _allUsers.value.find(u => u.id === id || u._id === id)
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
  }
}
