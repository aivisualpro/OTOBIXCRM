<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import PasswordInput from '~/components/PasswordInput.vue'

const username = ref('')
const contactNumber = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const config = useRuntimeConfig()

async function onSubmit(event: Event) {
  event.preventDefault()
  errorMessage.value = ''

  if (!username.value || !contactNumber.value || !password.value) {
    errorMessage.value = 'Please fill in all fields'
    return
  }

  isLoading.value = true

  try {
    const response = await $fetch<any>(`${config.public.apiBaseUrl}user/login`, {
      method: 'POST',
      body: {
        userName: username.value,
        phoneNumber: contactNumber.value,
        password: password.value,
      },
    })

    // Store auth data
    const isLoggedIn = useCookie('isLoggedIn')
    isLoggedIn.value = 'true'

    if (response?.token) {
      const authToken = useCookie('authToken')
      authToken.value = response.token
    }

    if (response?.user) {
      const userData = useCookie('userData')
      userData.value = JSON.stringify(response.user)
    }

    toast.success('Login successful! Redirecting...')
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
