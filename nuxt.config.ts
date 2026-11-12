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

  app: {
    head: {
      title: 'LCG Opportunity Management',
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' },
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
