/// <reference types="vite/client" />
import type { BlockSceneApi } from '../../preload'

declare global {
  interface Window {
    api: BlockSceneApi
  }
}
export {}
