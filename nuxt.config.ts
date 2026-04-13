import tailwindcss from '@tailwindcss/vite'

process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true'
// https://nuxt.com/docs/api/configuration/nuxt-config
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
      // Defaults — overridden by NUXT_PUBLIC_API_BASE_URL_* in .env
      apiBaseUrlProduction: '',
      apiBaseUrlDevelopment: '',
      apiBaseUrlStaging: '',
    },
  },

  watch: ['~/app.config.ts'],

  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
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
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "~/components/ui"
     */
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

  nitro: {
    preset: 'vercel',
    hooks: {
      'compiled': (nitro) => {
        const fs = require('node:fs')
        const path = require('node:path')
        const swPath = path.resolve(nitro.options.output.publicDir, 'sw.js')
        if (fs.existsSync(swPath)) {
          let swCode = fs.readFileSync(swPath, 'utf8')
          swCode += `\n// Build version: ${Date.now()}`
          fs.writeFileSync(swPath, swCode)
        }
      }
    }
  },

  compatibilityDate: '2024-12-14',
})
