import tailwindcss from '@tailwindcss/vite'

process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true'

export default defineNuxtConfig({
  devtools: { enabled: false },
  ssr: false,
  spaLoadingTemplate: false,
  devServer: { loadingTemplate: () => '' },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=2' },
        { rel: 'icon', type: 'image/png', href: '/icon-512x512.png?v=2' },
        { rel: 'apple-touch-icon', href: '/icon-512x512.png?v=2' },
      ],
    },
  },

  runtimeConfig: {
    mongodbUri: '',
    productionMongodbDbName: 'otobix_auction_app',
    developmentMongodbDbName: 'otobix_auction_app_development',
    public: {
      apiBaseUrlProduction: '',
      apiBaseUrlDevelopment: '',
      apiBaseUrlStaging: '',
    },
  },

  watch: ['~/app.config.ts'],

  css: ['~/assets/css/tailwind.css'],

  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
    },
  },

  components: [
    {
      path: '~/components',
      extensions: ['.vue'],
    },
  ],

  modules: [
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
  ],

  shadcn: {
    prefix: '',
    componentDir: '~/components/ui',
  },

  colorMode: {
    classSuffix: '',
  },

  eslint: {
    config: {
      standalone: false,
    },
  },

  fonts: {
    defaults: {
      weights: [300, 400, 500, 600, 700, 800],
    },
  },

  routeRules: {
    '/components': { redirect: '/components/accordion' },
    '/settings': { redirect: '/settings/workspaces' },
  },

  imports: {
    dirs: ['./lib'],
  },

  compatibilityDate: '2024-12-14',
})