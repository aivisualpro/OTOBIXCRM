export interface DropdownValue {
  [key: string]: any
}

export interface DropdownItem {
  _id: string
  dropdownName: string
  dropdownValues: any[]
  isActive: boolean
}

export function useDropdowns() {
  const dropdowns = ref<DropdownItem[]>([])
  const isFetched = ref(false)
  const isLoading = ref(false)

  async function fetchDropdowns(force = false) {
    if (isFetched.value && !force)
      return
    if (isLoading.value && !force)
      return

    isLoading.value = true
    try {
      const res = await $fetch<{ dropdowns: any[] }>('/api/dropdowns')
      dropdowns.value = res.dropdowns.map((d: any) => ({
        ...d,
        _id: d._id?.$oid || d._id || d.id,
      }))
      isFetched.value = true
    }
    catch (err) {
      console.error('[useDropdowns] Failed to fetch dropdowns:', err)
    }
    finally {
      isLoading.value = false
    }
  }

  function getOptions(dropdownName: string, labelKey?: string, valueKey?: string) {
    const safeName = (dropdownName || '').toString().toLowerCase().trim()
    const dropdown = dropdowns.value.find(d => (d.dropdownName || '').toString().toLowerCase().trim() === safeName)
    if (!dropdown || !dropdown.isActive)
      return []

    return dropdown.dropdownValues.map((v) => {
      if (typeof v === 'string') {
        return { label: v, value: v }
      }
      if (typeof v === 'object' && v !== null) {
        // If labelKey and valueKey are provided, use them. 
        // Else, try to guess or use the first key.
        const firstKey = Object.keys(v)[0] || ''
        const val = v[valueKey || 'value'] || v[labelKey || 'label'] || v[firstKey]
        const lbl = v[labelKey || 'label'] || v[valueKey || 'value'] || v[firstKey]
        return { ...v, label: String(lbl), value: String(val) }
      }
      return { label: String(v), value: String(v) }
    })
  }

  return {
    dropdowns,
    isFetched,
    isLoading,
    fetchDropdowns,
    getOptions,
  }
}
