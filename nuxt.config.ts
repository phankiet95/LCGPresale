// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },

  // Internal tool behind a login: a client-rendered SPA keeps auth simple and avoids
  // SSR-internal fetches losing the Cloudflare D1 binding. The API stays server-side.
  ssr: false,

  // nitro-cloudflare-dev exposes the D1 binding from wrangler.jsonc during `nuxt dev`
  // (local SQLite under .wrangler/, or the real D1 if the binding has "remote": true).
  modules: ['nuxt-auth-utils', 'nitro-cloudflare-dev'],

  css: ['~/assets/css/main.css'],

  // Animated LCG splash shown until the SPA has loaded (app/spa-loading-template.html); SplashScreen.vue takes over.
  spaLoadingTemplate: 'spa-loading-template.html',

  app: {
    head: {
      title: 'LCG Opportunity Management',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'color-scheme', content: 'light dark' }],
      // Apply the saved theme before first paint (no light flash in dark mode). Mirrors app/composables/useTheme.ts.
      script: [{
        tagPosition: 'head',
        innerHTML: `(function(){var t;try{t=localStorage.getItem('lcg.theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()`,
      }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap' },
      ],
    },
  },

  nitro: {
    preset: 'cloudflare_module',
    cloudflare: { nodeCompat: true },
  },

  runtimeConfig: {
    // Sealed-cookie session (nuxt-auth-utils). Secret comes from NUXT_APP_SECRET (>= 32 chars).
    session: {
      name: 'lcg-session',
      maxAge: 60 * 60 * 12, // 12h
    },
  },

  typescript: {
    tsConfig: { compilerOptions: { types: ['@cloudflare/workers-types'] } },
  },
})
