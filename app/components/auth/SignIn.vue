<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import PasswordInput from '~/components/PasswordInput.vue'

const username = ref('')
const contactNumber = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const { currentEnv, apiBaseUrl, envLabel, setEnvironment } = useApiEnvironment()

async function onSubmit(event: Event) {
  event.preventDefault()
  errorMessage.value = ''

  if (!username.value || !contactNumber.value || !password.value) {
    errorMessage.value = 'Please fill in all fields'
    return
  }

  isLoading.value = true

  try {
    const response = await $fetch<any>(`${apiBaseUrl.value}user/login`, {
      method: 'POST',
      body: {
        userName: username.value,
        phoneNumber: contactNumber.value,
        password: password.value,
      },
    })

    // 30-day persistent session
    const maxAge = 30 * 24 * 60 * 60 // 30 days in seconds
    const cookieOpts = { maxAge, path: '/', sameSite: 'lax' as const }

    // Store auth data with 30-day expiry
    const isLoggedIn = useCookie('isLoggedIn', cookieOpts)
    isLoggedIn.value = 'true'

    if (response?.token) {
      const authToken = useCookie('authToken', cookieOpts)
      authToken.value = response.token
    }

    if (response?.user) {
      const userData = useCookie('userData', cookieOpts)
      userData.value = JSON.stringify(response.user)
    }

    toast.success('Login successful! Redirecting...')

    // Start prefetching data immediately — it'll load during the redirect
    const { bootPrefetch } = usePrefetch()
    bootPrefetch()

    navigateTo('/')
  }
  catch (err: any) {
    const message = err?.data?.message || err?.statusMessage || 'Login failed. Please check your credentials.'
    errorMessage.value = message
    toast.error(message)
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form class="grid gap-6" @submit="onSubmit">
    <!-- Environment Selector -->
    <div class="rounded-xl border bg-card/50 p-3">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Environment</span>
        <Badge
          variant="outline"
          class="text-[10px] h-5"
          :class="currentEnv === 'production'
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'"
        >
          {{ envLabel }}
        </Badge>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all"
          :class="currentEnv === 'production'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20'
            : 'border-border hover:bg-accent text-muted-foreground'"
          @click="setEnvironment('production')"
        >
          <span class="size-2 rounded-full" :class="currentEnv === 'production' ? 'bg-emerald-500' : 'bg-muted-foreground/30'" />
          Production
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all"
          :class="currentEnv === 'development'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20'
            : 'border-border hover:bg-accent text-muted-foreground'"
          @click="setEnvironment('development')"
        >
          <span class="size-2 rounded-full" :class="currentEnv === 'development' ? 'bg-amber-500' : 'bg-muted-foreground/30'" />
          Development
        </button>
      </div>
    </div>

    <div class="grid gap-2">
      <Label for="username">
        Username
      </Label>
      <Input
        id="username"
        v-model="username"
        type="text"
        placeholder="Enter your username"
        :disabled="isLoading"
      />
    </div>
    <div class="grid gap-2">
      <Label for="contact">
        Contact Number
      </Label>
      <Input
        id="contact"
        v-model="contactNumber"
        type="tel"
        placeholder="+1 (555) 000-0000"
        :disabled="isLoading"
      />
    </div>
    <div class="grid gap-2">
      <div class="flex items-center">
        <Label for="password">
          Password
        </Label>
        <NuxtLink
          to="/forgot-password"
          class="ml-auto inline-block text-sm underline"
        >
          Forgot your password?
        </NuxtLink>
      </div>
      <PasswordInput id="password" v-model="password" />
    </div>
    <div v-if="errorMessage" class="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
      {{ errorMessage }}
    </div>
    <Button type="submit" class="w-full" :disabled="isLoading">
      <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
      Login
    </Button>
  </form>
</template>
