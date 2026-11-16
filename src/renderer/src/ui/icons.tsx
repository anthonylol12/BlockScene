import type { JSX } from 'react'

const P: Record<string, string> = {
  eye: 'M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Zm7 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  eyeOff: 'M2 2l12 12M6.5 3.3A7 7 0 0 1 8 3c4.5 0 7 5 7 5a12 12 0 0 1-1.9 2.5M4 4.6C2.2 5.9 1 8 1 8s2.5 5 7 5a6.8 6.8 0 0 0 3-.7',
  trash: 'M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v5M9.2 6.5v5',
  plus: 'M8 2.5v11M2.5 8h11',
  move: 'M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2',
  rotate: 'M13.5 8A5.5 5.5 0 1 1 11.6 3.8M13.5 1.8v3.4h-3.4',
  scale: 'M2 14 14 2M9.5 2H14v4.5M6.5 14H2V9.5',
  frame: 'M2 5.5V2h3.5M10.5 2H14v3.5M14 10.5V14h-3.5M5.5 14H2v-3.5M8 6v4M6 8h4',
  camera: 'M2 5h2.5L6 3h4l1.5 2H14v8H2V5Zm6 6.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z',
  play: 'M4.5 2.5v11l9-5.5-9-5.5Z',
  pause: 'M4.5 2.5h2.5v11H4.5zM9 2.5h2.5v11H9z',
  star: 'M8 1.8 9.9 5.7l4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6Z',
  cube: 'M8 1.5 14 4.7v6.6L8 14.5 2 11.3V4.7L8 1.5Zm0 0v13M2 4.7l6 3.3 6-3.3',
  sun: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1',
  layers: 'M8 1.8 14.5 5 8 8.2 1.5 5 8 1.8ZM1.5 8 8 11.2 14.5 8M1.5 11 8 14.2 14.5 11',
  image: 'M2 2.5h12v11H2zM2 11l3.5-3.5 3 3 2-2 3.5 3.5M10.5 6.2a1.2 1.2 0 1 0 0-.1',
  text: 'M2.5 3.5v-1h11v1M8 2.5v11M5.5 13.5h5',
  rect: 'M2.5 3.5h11v9h-11z',
  folder: 'M1.5 4V13h13V5.5H8L6.5 4h-5Z',
  save: 'M2.5 2.5h9l2 2v9h-11zM5 2.5v3.5h5.5V2.5M5 13.5V9h6v4.5',
  download: 'M8 2v8.5M4.5 7 8 10.5 11.5 7M2.5 13.5h11',
  import: 'M8 10.5V2M4.5 5.5 8 2l3.5 3.5M2.5 10v3.5h11V10',
  grid: 'M2 2h12v12H2zM6 2v12M10 2v12M2 6h12M2 10h12',
  up: 'M8 13V3M4 7l4-4 4 4',
  down: 'M8 3v10M4 9l4 4 4-4',
  lock: 'M4 7.5h8v6.5H4zM5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5',
  unlock: 'M4 7.5h8v6.5H4zM5.5 7.5V5a2.5 2.5 0 0 1 5-.5',
  copy: 'M5.5 5.5h8v8h-8zM10.5 5.5v-3h-8v8h3',
  alignL: 'M2.5 1.5v13M5 4h8v3H5zM5 9h5v3H5z',
  alignCH: 'M8 1.5v13M3.5 4h9v3h-9zM5 9h6v3H5z',
  alignR: 'M13.5 1.5v13M3 4h8v3H3zM6 9h5v3H6z',
  alignT: 'M1.5 2.5h13M4 5v8h3V5zM9 5v5h3V5z',
  alignCV: 'M1.5 8h13M4 3.5v9h3v-9zM9 5v6h3V5z',
  alignB: 'M1.5 13.5h13M4 3v8h3V3zM9 6v5h3V6z',
  light: 'M8 1.5a4.5 4.5 0 0 0-2.5 8.2V12h5V9.7A4.5 4.5 0 0 0 8 1.5ZM6 14h4',
  tree: 'M8 1.5 3.5 7h2L3 10.5h10L10.5 7h2L8 1.5ZM8 10.5v4',
  water: 'M1.5 6c1.5-1.3 3-1.3 4.3 0s2.9 1.3 4.4 0 3-1.3 4.3 0M1.5 10c1.5-1.3 3-1.3 4.3 0s2.9 1.3 4.4 0 3-1.3 4.3 0',
  info: 'M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM8 7v4.5M8 4.6v.2',
  close: 'M3.5 3.5l9 9M12.5 3.5l-9 9',
  gear: 'M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4'
}

export function Icon({ name, size = 15, title }: { name: keyof typeof P | string; size?: number; title?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden={!title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name] ?? P.cube} />
    </svg>
  )
}

export const KIND_ICON: Record<string, string> = {
  build: 'cube', base: 'rect', terrain: 'layers', water: 'water', path: 'grid', rock: 'cube', tree: 'tree', vegetation: 'tree', light: 'light', decor: 'star'
}
