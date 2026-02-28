export interface Banner {
    [key: string]: any
    _id: string
    imageUrl: string
    screenName: string
    status: string
    type: string
    view: string
    cloudinaryPublicId?: string
    createdAt?: string
    updatedAt?: string
}

export interface BannerFilters {
    view?: string
    type?: string
    status?: string
}

// ─── Global cache ───
const _allBanners = ref<Banner[]>([])
const _isFetched = ref(false)
const _isFetching = ref(false)
const _fetchError = ref<string | null>(null)
const _totalCount = ref(0)

export function useBannersApi() {
    const { apiBaseUrl } = useApiEnvironment()
    const authToken = useCookie('authToken')

    function headers(): Record<string, string> {
        const h: Record<string, string> = {}
        if (authToken.value)
            h.Authorization = `Bearer ${authToken.value}`
        return h
    }

    /** Fetch banners list with optional filters */
    async function fetchBanners(filters: BannerFilters = {}, force = false) {
        if (_isFetched.value && !force)
            return
        if (_isFetching.value && !force)
            return

        _isFetching.value = true
        _fetchError.value = null

        try {
            const body: Record<string, any> = {}
            if (filters.view) body.view = filters.view
            if (filters.type) body.type = filters.type
            if (filters.status) body.status = filters.status

            const response = await $fetch<any>(
                `${apiBaseUrl.value}admin/banners/get-list`,
                { method: 'POST', headers: headers(), body },
            )

            const bannersArray = Array.isArray(response)
                ? response
                : response?.banners || response?.data || response?.result || []

            _allBanners.value = bannersArray.map((item: any) => ({
                ...item,
                _id: item._id || item.id,
            }))

            _isFetched.value = true
        }
        catch (err: any) {
            _fetchError.value = err?.data?.message || err?.message || 'Failed to fetch banners'
            _allBanners.value = []
        }
        finally {
            _isFetching.value = false
        }
    }

    /** Force re-fetch */
    async function refreshBanners(filters: BannerFilters = {}) {
        await fetchBanners(filters, true)
    }

    /** Get banners count */
    async function fetchBannersCount(filters: { type?: string, view?: string } = {}) {
        try {
            const body: Record<string, any> = {}
            if (filters.type) body.type = filters.type
            if (filters.view) body.view = filters.view

            const response = await $fetch<any>(
                `${apiBaseUrl.value}admin/banners/get-count`,
                { method: 'POST', headers: headers(), body },
            )

            _totalCount.value = response?.count || response?.total || 0
            return _totalCount.value
        }
        catch (err: any) {
            console.error('[useBannersApi] Failed to fetch count:', err)
            return 0
        }
    }

    /** Add a new banner */
    async function addBanner(payload: { screenName: string, status: string, type: string, view: string }) {
        const response = await $fetch<any>(
            `${apiBaseUrl.value}admin/banners/add`,
            { method: 'POST', headers: headers(), body: payload },
        )
        await refreshBanners()
        return response
    }

    /** Update banner status */
    async function updateBannerStatus(bannerId: string, status: string) {
        const response = await $fetch<any>(
            `${apiBaseUrl.value}admin/banners/update-status`,
            { method: 'POST', headers: headers(), body: { bannerId, status } },
        )
        // Optimistic update
        const banner = _allBanners.value.find(b => b._id === bannerId)
        if (banner) banner.status = status
        return response
    }

    /** Delete a banner */
    async function deleteBanner(bannerId: string) {
        const response = await $fetch<any>(
            `${apiBaseUrl.value}admin/banners/delete`,
            { method: 'POST', headers: headers(), body: { bannerId } },
        )
        _allBanners.value = _allBanners.value.filter(b => b._id !== bannerId)
        return response
    }

    return {
        allBanners: _allBanners,
        isLoading: _isFetching,
        isFetched: _isFetched,
        fetchError: _fetchError,
        totalCount: _totalCount,
        fetchBanners,
        refreshBanners,
        fetchBannersCount,
        addBanner,
        updateBannerStatus,
        deleteBanner,
    }
}
