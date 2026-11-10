// Lo que vite-plugin-pwa inyecta al construir: la lista de archivos a guardar.
declare interface ServiceWorkerGlobalScope {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>;
}
