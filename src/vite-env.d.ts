/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  // add more as needed
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}