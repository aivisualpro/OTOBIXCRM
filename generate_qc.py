import re

with open('app/pages/inspection/[id].vue', 'r') as f:
    content = f.read()

# Make it saveable
script_additions = """
import { toast } from 'vue-sonner'

const editForm = ref<Record<string, any>>({})
const isSaving = ref(false)

watch(() => car.value, (newVal) => {
  if (newVal) {
    editForm.value = JSON.parse(JSON.stringify(newVal))
  }
}, { immediate: true })

async function saveQC() {
  isSaving.value = true
  try {
    const userCookie = useCookie('userData')
    const currentUser = userCookie.value ? (typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value) : {}
    
    // the telecallingId or appointmentId is needed
    // The get API merges them. We send updates using the appointmentId as telecallingId for the update API fallback in server
    await $fetch('/api/leads/update', {
      method: 'PUT',
      body: {
        telecallingId: editForm.value._id || editForm.value.appointmentId,
        make: editForm.value.make,
        model: editForm.value.model,
        variant: editForm.value.variant,
        fuelType: editForm.value.fuelType,
        cubicCapacity: Number(editForm.value.cubicCapacity) || null,
        registrationNumber: editForm.value.registrationNumber,
        odometerReadingInKms: Number(editForm.value.odometerReadingInKms) || null,
        ownerSerialNumber: Number(editForm.value.ownerSerialNumber) || null,
        priceDiscovery: Number(editForm.value.priceDiscovery) || null,
        ...editForm.value, // Send all mutated fields
      }
    })
    toast.success('QC Report Saved Successfully')
    
    // Refetch to reset
    await fetchCarDetails(carId)
  } catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Failed to save')
  } finally {
    isSaving.value = false
  }
}

async function approveLead() {
  editForm.value.approvalStatus = 'Approved'
  await saveQC()
  router.push('/leads/approved')
}

async function rejectLead() {
  editForm.value.approvalStatus = 'Quality Rejected'
  await saveQC()
  router.push('/leads/rejected')
}

function removeImage(key: string, idx: number) {
  if (Array.isArray(editForm.value[key])) {
    editForm.value[key].splice(idx, 1)
  }
}

function addImage(key: string) {
  const url = prompt('Enter Image URL linking to Drive or Storage:', '')
  if (url) {
    if (!Array.isArray(editForm.value[key])) editForm.value[key] = []
    editForm.value[key].push(url)
  }
}
"""

content = content.replace("const activeTab = ref('document-details')", script_additions + "\nconst activeTab = ref('document-details')")

# Fix Page Header
content = content.replace("setHeader({ title: `Inspection: ${carId}`", "setHeader({ title: `Quality Control: ${carId}`")

# Replace read-only parts rendering with Inputs
read_only_part = """<p class="text-sm font-medium">
                          {{ car[part.key] || '—' }}
                        </p>"""

editable_part = """<Input v-model="editForm[part.key]" class="h-8 mt-1 text-sm font-medium w-full max-w-[200px]" placeholder="Value" />"""

content = content.replace(read_only_part, editable_part)

# Make simple labels editable
read_only_simple = """<p class="text-sm font-semibold">
                  {{ car.registrationNumber }}
                </p>"""
editable_simple = """<Input v-model="editForm.registrationNumber" class="h-8 text-sm font-semibold"  />"""
content = content.replace(read_only_simple, editable_simple)

read_only_simple = """<p class="text-sm font-semibold">
                  {{ (car.odometerReadingInKms || 0).toLocaleString() }} km
                </p>"""
editable_simple = """<Input v-model="editForm.odometerReadingInKms" type="number" class="h-8 text-sm font-semibold"  />"""
content = content.replace(read_only_simple, editable_simple)

read_only_simple = """<p class="text-sm font-semibold">
                  {{ car.ownerSerialNumber || '—' }}{{ car.ownerSerialNumber === 1 ? 'st' : car.ownerSerialNumber === 2 ? 'nd' : car.ownerSerialNumber === 3 ? 'rd' : 'th' }}
                </p>"""
editable_simple = """<Input v-model="editForm.ownerSerialNumber" type="number" class="h-8 text-sm font-semibold"  />"""
content = content.replace(read_only_simple, editable_simple)

read_only_simple = """<p class="text-sm font-semibold text-primary">
                  ₹{{ (car.priceDiscovery || 0).toLocaleString() }}
                </p>"""
editable_simple = """<Input v-model="editForm.priceDiscovery" type="number" class="h-8 text-sm font-semibold text-primary"  />"""
content = content.replace(read_only_simple, editable_simple)


# For the header fields
content = content.replace(
    "{{ car.make }} {{ car.model }}", 
    "<div class=\"flex gap-2\"><Input v-model=\"editForm.make\" class=\"h-8 font-bold\"><Input v-model=\"editForm.model\" class=\"h-8 font-bold\"></div>"
)

# For Document Details tab standard pairs
content = content.replace("value: car.", "value: editForm.")

doc_details_loop = """<div
                  v-for="item in [
                    { label: 'Registration Number', value: editForm.registrationNumber },
                    { label: 'Registration Date', value: formatDate(editForm.registrationDate) },
                    { label: 'Registration Type', value: editForm.registrationType },
                    { label: 'Registration State', value: editForm.registrationState },
                    { label: 'Registered RTO', value: editForm.registeredRto },
                    { label: 'Fitness Validity', value: formatDate(editForm.fitnessValidity) },
                    { label: 'To Be Scrapped', value: editForm.toBeScrapped },
                    { label: 'Owner Serial Number', value: editForm.ownerSerialNumber },
                  ]\""""

doc_details_editable = """<div
                  v-for="(val, key) in {
                    registrationNumber: 'Registration Number',
                    registrationDate: 'Registration Date',
                    registrationType: 'Registration Type',
                    registrationState: 'Registration State',
                    registeredRto: 'Registered RTO',
                    fitnessValidity: 'Fitness Validity',
                    toBeScrapped: 'To Be Scrapped',
                    ownerSerialNumber: 'Owner Serial Number'
                  }\""""

content = content.replace(doc_details_loop, doc_details_editable)

content = content.replace(""":key="item.label"
                >
                  <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                    {{ item.label }}
                  </p>
                  <p class="text-sm font-medium">
                    {{ item.value || '—' }}
                  </p>
                </div>""", """:key="key"
                >
                  <p class="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                    {{ val }}
                  </p>
                  <Input v-model="editForm[key]" class="h-8 text-sm font-medium" />
                </div>""")

# Do the same for Car Specs, Insurance, Taxation
content = content.replace(
"""                  v-for="item in [
                    { label: 'Make', value: editForm.make },
                    { label: 'Model', value: editForm.model },
                    { label: 'Variant', value: editForm.variant },
                    { label: 'Engine Number', value: editForm.engineNumber },
                    { label: 'Chassis Number', value: editForm.chassisNumber },
                    { label: 'Mfg. Date', value: formatDate(editForm.yearAndMonthOfManufacture) },
                    { label: 'Fuel Type', value: editForm.fuelType },
                    { label: 'Cubic Capacity', value: editForm.cubicCapacity ? `${editForm.cubicCapacity} cc` : '' },
                  ]\"""",
"""                  v-for="(val, key) in {
                    make: 'Make',
                    model: 'Model',
                    variant: 'Variant',
                    engineNumber: 'Engine Number',
                    chassisNumber: 'Chassis Number',
                    yearAndMonthOfManufacture: 'Mfg. Date',
                    fuelType: 'Fuel Type',
                    cubicCapacity: 'Cubic Capacity',
                  }\"""")

content = content.replace(
"""                  v-for="item in [
                    { label: 'Insurance Provider', value: editForm.insuranceDropdownList || editForm.insurance },
                    { label: 'Policy Number', value: editForm.policyNumber },
                    { label: 'Validity', value: formatDate(editForm.insuranceValidity) },
                    { label: 'Insurance Mismatch', value: editForm.mismatchInInsuranceDropdownList || editForm.mismatchInInsurance },
                  ]\"""",
"""                  v-for="(val, key) in {
                    insuranceDropdownList: 'Insurance Provider',
                    policyNumber: 'Policy Number',
                    insuranceValidity: 'Validity',
                    mismatchInInsuranceDropdownList: 'Insurance Mismatch',
                  }\"""")

content = content.replace(
"""                  v-for="item in [
                    { label: 'Road Tax Validity', value: editForm.roadTaxValidity },
                    { label: 'Tax Valid Till', value: formatDate(editForm.taxValidTill) },
                  ]\"""",
"""                  v-for="(val, key) in {
                    roadTaxValidity: 'Road Tax Validity',
                    taxValidTill: 'Tax Valid Till',
                  }\"""")

# Add QC Footer Action Bar
footer = """
      <!-- QC Footer Actions -->
      <div class="shrink-0 border-t bg-background/95 backdrop-blur shadow-[0_-4px_10px_-5px_rgba(0,0,0,0.1)] p-4 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium">Quality Control Action</p>
          <p class="text-xs text-muted-foreground">Review details and authorize publication</p>
        </div>
        <div class="flex items-center gap-3">
          <Button variant="outline" @click="saveQC" :disabled="isSaving">
            <Icon v-if="isSaving" name="i-lucide-loader-2" class="size-4 mr-2 animate-spin" />
            <Icon v-else name="i-lucide-save" class="size-4 mr-2" />
            Save Draft
          </Button>
          <Button variant="destructive" @click="rejectLead" :disabled="isSaving">
            <Icon name="i-lucide-x-circle" class="size-4 mr-2" />
            Reject QC
          </Button>
          <Button class="bg-emerald-600 hover:bg-emerald-700 text-white" @click="approveLead" :disabled="isSaving">
            <Icon name="i-lucide-check-circle" class="size-4 mr-2" />
            Approve & Publish
          </Button>
        </div>
      </div>
    </template>
"""
content = content.replace("    </template>\n  </div>", footer + "  </div>")


# Make Images array editable with a small overlay to remove or add
image_old = """                  <div
                    v-for="(url, idx) in getImages(car, imgKey)"
                    :key="`${imgKey}-${idx}`"
                    class="shrink-0 h-24 w-24 md:h-28 md:w-28 rounded-lg overflow-hidden relative group cursor-pointer border bg-muted"
                    @click="openLightboxUrls(getImages(car, imgKey), idx, humanize(imgKey))"
                  >
                    <img :src="url" :alt="humanize(imgKey)" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy">
                    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                      <p class="text-[9px] text-white truncate text-center">
                        {{ humanize(imgKey) }} {{ idx + 1 }}
                      </p>
                    </div>
                  </div>"""

image_new = """                  <div class="shrink-0 h-24 w-24 md:h-28 md:w-28 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/50 transition-colors" @click="addImage(imgKey)">
                    <Icon name="i-lucide-plus" class="size-5 text-muted-foreground" />
                    <span class="text-[10px] text-muted-foreground text-center leading-tight mx-2">Add<br>{{ humanize(imgKey) }}</span>
                  </div>
                  <div
                    v-for="(url, idx) in getImages(editForm, imgKey)"
                    :key="`${imgKey}-${idx}`"
                    class="shrink-0 h-24 w-24 md:h-28 md:w-28 rounded-lg overflow-hidden relative group border bg-muted"
                  >
                    <img :src="url" :alt="humanize(imgKey)" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 cursor-pointer" loading="lazy" @click="openLightboxUrls(getImages(editForm, imgKey), idx, humanize(imgKey))">
                    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                      <p class="text-[9px] text-white truncate text-center">
                        {{ humanize(imgKey) }} {{ idx + 1 }}
                      </p>
                    </div>
                    <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Button variant="destructive" size="icon" class="size-6 rounded-full" @click.stop="removeImage(imgKey, idx)">
                         <Icon name="i-lucide-trash" class="size-3" />
                       </Button>
                    </div>
                  </div>"""
content = content.replace(image_old, image_new)


with open('app/pages/qc/[id].vue', 'w') as f:
    f.write(content)
