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

export function usePeopleApi() {
  const config = useRuntimeConfig()
  const authToken = useCookie('authToken')

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
        `${config.public.apiBaseUrl}user/all-users-list`,
        {
          method: 'GET',
          headers: {
            ...(authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}),
          },
        },
      )

      // Extract users array from response
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

  /** Force re-fetch */
  async function refreshUsers() {
    await fetchAllUsers(true)
  }

  return {
    allUsers: _allUsers,
    isLoading: _isFetching,
    isFetched: _isFetched,
    fetchError: _fetchError,
    fetchAllUsers,
    refreshUsers,
  }
}
