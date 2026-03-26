<script setup lang="ts">
import { toast } from 'vue-sonner'

// ─── CSV Column Mapping ───
const csvHeaderMap: Record<string, string> = {
  'createdAt': 'createdAt',
  'appointmentId': 'appointmentId',
  'emailAddress': 'emailAddress',
  'appointmentSource': 'appointmentSource',
  'otherSource': 'otherSource',
  'NCDUCDName': 'ncdUcdName',
  'NCDRepresentativeName': 'repName',
  'NCDRepresentativeContactNo': 'repContact',
  'vehicleStatus': 'vehicleStatus',
  'inspectionAddress': 'inspectionAddress',
  'zipCode': 'zipCode',
  'yearOfManufacture': 'yearOfManufacture',
  'make': 'make',
  'model': 'model',
  'variant': 'variant',
  'odometerReading': 'odometerReadingInKms',
  'ownershipSerialNumber': 'ownershipSerialNumber',
  'inspectionDateTime': 'inspectionDateTime',
  'ownerName': 'ownerName',
  'customerContactNumber': 'customerContactNumber',
  'remarks': 'remarks',
  'city': 'city',
  'allocatedTo': 'allocatedTo',
  'inspectionEngineerNumber': 'inspectionEngineerNumber',
  'inspectionStatus': 'inspectionStatus',
  'referenceName': 'referenceName',
  'bankSource': 'bankSource',
  'priority': 'priority',
  'addedBy': 'addedBy',
}

// All target DB fields
const dbFields = [
  { value: '_skip', label: '— Skip this column —' },
  { value: 'ownerName', label: 'Owner Name' },
  { value: 'customerContactNumber', label: 'Contact Number' },
  { value: 'carRegistrationNumber', label: 'Car Registration Number' },
  { value: 'emailAddress', label: 'Email Address' },
  { value: 'make', label: 'Make' },
  { value: 'model', label: 'Model' },
  { value: 'variant', label: 'Variant' },
  { value: 'yearOfRegistration', label: 'Year of Registration' },
  { value: 'yearOfManufacture', label: 'Year of Manufacture' },
  { value: 'odometerReadingInKms', label: 'Odometer (KM)' },
  { value: 'ownershipSerialNumber', label: 'Ownership Number' },
  { value: 'vehicleStatus', label: 'Vehicle Status' },
  { value: 'city', label: 'City' },
  { value: 'zipCode', label: 'ZIP Code' },
  { value: 'inspectionAddress', label: 'Inspection Address' },
  { value: 'inspectionDateTime', label: 'Inspection Date & Time' },
  { value: 'inspectionStatus', label: 'Inspection Status' },
  { value: 'approvalStatus', label: 'Approval Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'appointmentSource', label: 'Appointment Source' },
  { value: 'allocatedTo', label: 'Allocated To' },
  { value: 'repName', label: 'Representative Name' },
  { value: 'repContact', label: 'Representative Contact' },
  { value: 'bankSource', label: 'Bank Source' },
  { value: 'referenceName', label: 'Reference Name' },
  { value: 'otherSource', label: 'Other Source' },
  { value: 'ncdUcdName', label: 'NCD/UCD Name' },
  { value: 'remarks', label: 'Remarks' },
  { value: 'additionalNotes', label: 'Additional Notes' },
  { value: 'appointmentId', label: 'Appointment ID' },
  { value: 'addedBy', label: 'Added By' },
  { value: 'inspectionEngineerNumber', label: 'Inspection Engineer No.' },
  { value: 'createdAt', label: 'Created At' },
]

// ─── State Machine ───
type WizardStep = 'idle' | 'mapping' | 'preview' | 'importing' | 'done'
const wizardStep = ref<WizardStep>('idle')

// File data
const fileName = ref('')
const fileSize = ref(0)
const rawHeaders = ref<string[]>([])
const rawRows = ref<string[][]>([])
const columnMapping = ref<Record<string, string>>({})

// Import progress
const importProgress = ref(0)
const importTotal = ref(0)
const importedCount = ref(0)
const importErrors = ref<string[]>([])
const batchSize = 200

// Drag state
const isDragging = ref(false)

// ─── CSV Parser (auto-detects tab or comma delimiter) ───
function parseCSV(text: string): { headers: string[], rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  // Auto-detect delimiter: tab or comma
  const firstLine = lines[0]!
  const delimiter = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ','

  function parseLine(line: string): string[] {
    if (delimiter === '\t') {
      return line.split('\t').map(v => v.trim().replace(/^"|"$/g, ''))
    }
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        }
        else {
          inQuotes = !inQuotes
        }
      }
      else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      }
      else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(firstLine)
  const rows = lines.slice(1).map(l => parseLine(l))
  return { headers, rows }
}

// ─── File Handling ───
function handleFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    toast.error('Please select a CSV file')
    return
  }
  fileName.value = file.name
  fileSize.value = file.size

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    const { headers, rows } = parseCSV(text)

    if (headers.length === 0) {
      toast.error('Could not parse CSV headers')
      return
    }

    rawHeaders.value = headers
    rawRows.value = rows

    // Auto-map columns using exact match, then normalized match, then fuzzy
    const mapping: Record<string, string> = {}
    headers.forEach((h) => {
      // 1. Exact match
      let mapped = csvHeaderMap[h] || csvHeaderMap[h.trim()]
      // 2. Normalized match: strip spaces, slashes, underscores, lowercase
      if (!mapped) {
        const normalized = h.trim().replace(/[\s/_-]/g, '').toLowerCase()
        const found = Object.entries(csvHeaderMap).find(
          ([k]) => k.replace(/[\s/_-]/g, '').toLowerCase() === normalized,
        )
        mapped = found?.[1]
      }
      // 3. Fuzzy match: compare against db field values/labels
      if (!mapped) {
        const lower = h.toLowerCase().trim()
        const found = dbFields.find(f => f.value.toLowerCase() === lower || f.label.toLowerCase() === lower)
        mapped = found?.value
      }
      mapping[h] = mapped || '_skip'
    })
    columnMapping.value = mapping
    wizardStep.value = 'mapping'
    toast.success(`Parsed ${rows.length} rows from "${file.name}"`)
  }
  reader.readAsText(file)
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

// ─── Mapped Rows Computed ───
const mappedRows = computed(() => {
  return rawRows.value.map((row) => {
    const obj: Record<string, any> = {}
    rawHeaders.value.forEach((h, i) => {
      const target = columnMapping.value[h]
      if (target && target !== '_skip') {
        obj[target] = row[i] || ''
      }
    })
    return obj
  })
})

const mappedFieldCount = computed(() => {
  return Object.values(columnMapping.value).filter(v => v !== '_skip').length
})

const skippedFieldCount = computed(() => {
  return Object.values(columnMapping.value).filter(v => v === '_skip').length
})

// Preview: show first 10
const previewRows = computed(() => mappedRows.value.slice(0, 10))
const previewColumns = computed(() => {
  const mapped = Object.entries(columnMapping.value)
    .filter(([, v]) => v !== '_skip')
    .map(([, v]) => v)
  return [...new Set(mapped)]
})

function getFieldLabel(key: string): string {
  return dbFields.find(f => f.value === key)?.label || key
}

// ─── Import ───
async function startImport() {
  const rows = mappedRows.value
  importTotal.value = rows.length
  importProgress.value = 0
  importedCount.value = 0
  importErrors.value = []
  wizardStep.value = 'importing'

  // Import in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    try {
      const result = await $fetch<any>('/api/leads/import', {
        method: 'POST',
        body: { rows: batch },
      })
      importedCount.value += result.insertedCount || batch.length
    }
    catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Batch failed'
      importErrors.value.push(`Rows ${i + 1}-${Math.min(i + batchSize, rows.length)}: ${msg}`)
    }
    importProgress.value = Math.min(i + batchSize, rows.length)
  }

  wizardStep.value = 'done'
}

function resetWizard() {
  wizardStep.value = 'idle'
  fileName.value = ''
  fileSize.value = 0
  rawHeaders.value = []
  rawRows.value = []
  columnMapping.value = {}
  importProgress.value = 0
  importTotal.value = 0
  importedCount.value = 0
  importErrors.value = []
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const progressPercent = computed(() => {
  if (importTotal.value === 0) return 0
  return Math.round((importProgress.value / importTotal.value) * 100)
})
</script>

<template>
  <div class="space-y-6 p-4 lg:p-6">
    <!-- ═══════ STEP: IDLE — Show import cards ═══════ -->
    <div v-if="wizardStep === 'idle'" class="space-y-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Leads Import Card -->
        <div
          class="import-card group relative rounded-xl border bg-card overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/40"
          @click="($refs.fileInput as HTMLInputElement)?.click()"
        >
          <div class="p-5 flex items-center gap-4">
            <div class="size-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
              <Icon name="i-lucide-magnet" class="size-5 text-primary" />
            </div>
            <div class="min-w-0">
              <h3 class="font-semibold text-sm">Leads</h3>
              <p class="text-xs text-muted-foreground mt-0.5">Import from CSV</p>
            </div>
            <Icon name="i-lucide-upload" class="size-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".csv"
        class="hidden"
        @change="onFileInput"
      >
    </div>

    <!-- ═══════ STEP: MAPPING — Column mapping ═══════ -->
    <div v-else-if="wizardStep === 'mapping'" class="space-y-6">
      <!-- File info bar -->
      <div class="rounded-xl border bg-card p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="i-lucide-file-check" class="size-5 text-primary" />
          </div>
          <div>
            <p class="text-sm font-semibold">{{ fileName }}</p>
            <p class="text-xs text-muted-foreground">{{ formatFileSize(fileSize) }} · {{ rawRows.length }} rows · {{ rawHeaders.length }} columns</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="text-xs">
            <Icon name="i-lucide-check-circle" class="size-3 mr-1" />
            {{ mappedFieldCount }} mapped
          </Badge>
          <Badge v-if="skippedFieldCount > 0" variant="outline" class="text-xs">
            <Icon name="i-lucide-eye-off" class="size-3 mr-1" />
            {{ skippedFieldCount }} skipped
          </Badge>
        </div>
      </div>

      <!-- Column Mapping Table -->
      <div class="rounded-xl border bg-card overflow-hidden">
        <div class="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
          <Icon name="i-lucide-columns-3" class="size-4 text-primary" />
          <h3 class="text-sm font-bold">Column Mapping</h3>
          <span class="text-xs text-muted-foreground ml-auto">Map your CSV columns to CRM fields</span>
        </div>
        <div class="max-h-[480px] overflow-y-auto">
          <table class="w-full">
            <thead class="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
              <tr>
                <th class="text-left text-xs font-semibold text-muted-foreground px-5 py-2.5 w-1/3">CSV Column</th>
                <th class="text-center text-xs font-semibold text-muted-foreground px-3 py-2.5 w-16">→</th>
                <th class="text-left text-xs font-semibold text-muted-foreground px-5 py-2.5 w-1/3">CRM Field</th>
                <th class="text-left text-xs font-semibold text-muted-foreground px-5 py-2.5">Sample Data</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(header, idx) in rawHeaders"
                :key="header"
                class="border-t transition-colors"
                :class="columnMapping[header] === '_skip' ? 'bg-muted/20 opacity-60' : 'hover:bg-accent/30'"
              >
                <td class="px-5 py-3">
                  <div class="flex items-center gap-2">
                    <div class="size-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {{ idx + 1 }}
                    </div>
                    <code class="text-sm font-mono bg-muted px-2 py-0.5 rounded text-foreground">{{ header }}</code>
                  </div>
                </td>
                <td class="px-3 py-3 text-center">
                  <Icon
                    :name="columnMapping[header] === '_skip' ? 'i-lucide-x' : 'i-lucide-arrow-right'"
                    class="size-4"
                    :class="columnMapping[header] === '_skip' ? 'text-muted-foreground' : 'text-primary'"
                  />
                </td>
                <td class="px-5 py-3">
                  <select
                    v-model="columnMapping[header]"
                    class="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors cursor-pointer"
                    :class="columnMapping[header] === '_skip' ? 'text-muted-foreground' : 'text-foreground font-medium'"
                  >
                    <option v-for="f in dbFields" :key="f.value" :value="f.value">
                      {{ f.label }}
                    </option>
                  </select>
                </td>
                <td class="px-5 py-3">
                  <span class="text-xs text-muted-foreground font-mono truncate block max-w-[200px]">
                    {{ rawRows[0]?.[idx] || '—' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between">
        <Button variant="outline" @click="resetWizard">
          <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
          Back
        </Button>
        <div class="flex items-center gap-2">
          <p class="text-xs text-muted-foreground mr-2">
            {{ rawRows.length }} rows ready to preview
          </p>
          <Button @click="wizardStep = 'preview'">
            Preview Data
            <Icon name="i-lucide-eye" class="ml-1.5 size-3.5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- ═══════ STEP: PREVIEW — Data preview ═══════ -->
    <div v-else-if="wizardStep === 'preview'" class="space-y-6">
      <!-- Summary bar -->
      <div class="rounded-xl border bg-card p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="i-lucide-table-2" class="size-5 text-primary" />
            </div>
            <div>
              <p class="text-sm font-semibold">Data Preview</p>
              <p class="text-xs text-muted-foreground">
                Showing first {{ previewRows.length }} of {{ rawRows.length }} rows · {{ previewColumns.length }} mapped columns
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline" class="text-xs">
              <Icon name="i-lucide-database" class="size-3 mr-1" />
              {{ rawRows.length }} total rows
            </Badge>
          </div>
        </div>
      </div>

      <!-- Preview Table -->
      <div class="rounded-xl border bg-card overflow-hidden">
        <div class="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
              <tr>
                <th class="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 whitespace-nowrap">#</th>
                <th
                  v-for="col in previewColumns"
                  :key="col"
                  class="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 whitespace-nowrap"
                >
                  {{ getFieldLabel(col) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in previewRows"
                :key="i"
                class="border-t hover:bg-accent/30 transition-colors"
              >
                <td class="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{{ i + 1 }}</td>
                <td
                  v-for="col in previewColumns"
                  :key="col"
                  class="px-4 py-2.5 text-sm max-w-[200px] truncate"
                >
                  {{ row[col] || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between">
        <Button variant="outline" @click="wizardStep = 'mapping'">
          <Icon name="i-lucide-arrow-left" class="mr-1.5 size-3.5" />
          Back to Mapping
        </Button>
        <div class="flex items-center gap-3">
          <p class="text-xs text-muted-foreground">
            Ready to import <strong>{{ rawRows.length }}</strong> leads
          </p>
          <Button @click="startImport">
            <Icon name="i-lucide-rocket" class="mr-1.5 size-4" />
            Start Import
          </Button>
        </div>
      </div>
    </div>

    <!-- ═══════ STEP: IMPORTING — Progress ═══════ -->
    <div v-else-if="wizardStep === 'importing'" class="space-y-6">
      <div class="rounded-2xl border bg-card p-8 max-w-lg mx-auto text-center space-y-6">
        <!-- Animated icon -->
        <div class="mx-auto size-16 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
          <Icon name="i-lucide-upload" class="size-8 text-primary" />
        </div>

        <div>
          <h3 class="text-xl font-bold">Importing Leads...</h3>
          <p class="text-sm text-muted-foreground mt-1">
            Processing {{ importProgress }} of {{ importTotal }} rows
          </p>
        </div>

        <!-- Progress bar -->
        <div class="space-y-2">
          <div class="h-3 rounded-full bg-muted overflow-hidden">
            <div
              class="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
          <p class="text-sm font-semibold text-primary tabular-nums">{{ progressPercent }}%</p>
        </div>

        <!-- Batch info -->
        <div class="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <Icon name="i-lucide-layers" class="size-3.5" />
            Batch size: {{ batchSize }}
          </span>
          <span class="flex items-center gap-1">
            <Icon name="i-lucide-check-circle" class="size-3.5 text-primary" />
            {{ importedCount }} imported
          </span>
        </div>
      </div>
    </div>

    <!-- ═══════ STEP: DONE — Results ═══════ -->
    <div v-else-if="wizardStep === 'done'" class="space-y-6">
      <div class="rounded-2xl border bg-card p-8 max-w-lg mx-auto text-center space-y-6">
        <!-- Success/Error icon -->
        <div
          class="mx-auto size-16 rounded-xl flex items-center justify-center"
          :class="importErrors.length === 0 ? 'bg-primary/10' : 'bg-destructive/10'"
        >
          <Icon
            :name="importErrors.length === 0 ? 'i-lucide-check-circle' : 'i-lucide-alert-triangle'"
            class="size-8"
            :class="importErrors.length === 0 ? 'text-primary' : 'text-destructive'"
          />
        </div>

        <div>
          <h3 class="text-xl font-bold">
            {{ importErrors.length === 0 ? 'Import Complete!' : 'Import Finished with Warnings' }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ importedCount }} leads imported successfully
          </p>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-xl bg-primary/10 p-3">
            <p class="text-2xl font-bold text-primary tabular-nums">{{ importedCount }}</p>
            <p class="text-[11px] text-primary/70 font-medium mt-0.5">Imported</p>
          </div>
          <div class="rounded-xl bg-muted p-3">
            <p class="text-2xl font-bold text-foreground tabular-nums">{{ importTotal }}</p>
            <p class="text-[11px] text-muted-foreground font-medium mt-0.5">Total Rows</p>
          </div>
          <div class="rounded-xl bg-destructive/10 p-3">
            <p class="text-2xl font-bold text-destructive tabular-nums">{{ importErrors.length }}</p>
            <p class="text-[11px] text-destructive/70 font-medium mt-0.5">Errors</p>
          </div>
        </div>

        <!-- Errors detail -->
        <div v-if="importErrors.length > 0" class="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-left">
          <p class="text-sm font-medium text-destructive mb-2">Error Details</p>
          <ul class="space-y-1">
            <li v-for="(err, i) in importErrors" :key="i" class="text-xs text-destructive flex items-start gap-1.5">
              <Icon name="i-lucide-x-circle" class="size-3.5 shrink-0 mt-0.5" />
              {{ err }}
            </li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" @click="resetWizard">
            <Icon name="i-lucide-upload" class="mr-1.5 size-3.5" />
            Import More
          </Button>
          <NuxtLink to="/leads/leads">
            <Button>
              <Icon name="i-lucide-external-link" class="mr-1.5 size-3.5" />
              View Leads
            </Button>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import-card {
  animation: card-enter 0.4s ease forwards;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
