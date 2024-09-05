// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  devtools: { enabled: true },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  ssr: false,
  css: ["~/assets/css/main.css"],
  modules: ["nuxt-codemirror"],
  runtimeConfig: {
    public: {
      SUPABASE_SERVICE_ROLE: "",
    },
  },
});
