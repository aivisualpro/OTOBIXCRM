<script setup lang="ts">
definePageMeta({
  layout: 'blank',
})
</script>

<template>
  <LayoutAuth reverse video="/loginVideo3.mp4">
    <div class="grid mx-auto max-w-sm gap-6">
      <div class="flex flex-col items-center gap-6 text-center">
        <img src="/mainlogo.png" alt="OTOBIX Logo" class="h-28 w-auto object-contain" />
        <div class="grid gap-2">
          <h1 class="text-3xl font-bold tracking-tight text-primary">
            Welcome to OTOBIX
          </h1>
          <p class="text-sm text-muted-foreground leading-relaxed px-4">
            At OTOBIX, we're dedicated to transforming the used car buying and selling experience. Our mission is simple: to connect buyers and sellers seamlessly, providing the resources you need to make informed decisions.
          </p>
        </div>
      </div>
      <AuthSignIn />
    </div>
  </LayoutAuth>
</template>
