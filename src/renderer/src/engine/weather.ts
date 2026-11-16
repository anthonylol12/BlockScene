// Partículas de clima (lluvia / nieve) alrededor del punto de interés de la cámara
import * as THREE from 'three'
import type { Weather } from '@shared/types'

const MAX = 12000
const BOX = 90
const TOP = 60

export class WeatherSystem {
  readonly group = new THREE.Group()
  private rain: THREE.LineSegments
  private snow: THREE.Points
  private seeds = new Float32Array(MAX * 3)
  private mode: Weather = 'clear'
  private count = 0

  constructor() {
    for (let i = 0; i < MAX * 3; i++) this.seeds[i] = Math.random()
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 6), 3))
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaab8cc, transparent: true, opacity: 0.45, depthWrite: false }))
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3))
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true }))
    for (const o of [this.rain, this.snow]) {
      o.frustumCulled = false
      o.visible = false
      this.group.add(o)
    }
    this.group.name = '__weather'
  }

  set(mode: Weather, intensity: number): void {
    this.mode = mode
    this.count = Math.round(MAX * Math.min(1, Math.max(0, intensity)))
    this.rain.visible = mode === 'rain'
    this.snow.visible = mode === 'snow'
    this.rain.geometry.setDrawRange(0, this.count * 2)
    this.snow.geometry.setDrawRange(0, this.count)
  }

  update(t: number, center: THREE.Vector3): void {
    if (this.mode === 'clear' || !this.count) return
    const S = this.seeds
    if (this.mode === 'rain') {
      const arr = (this.rain.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      for (let i = 0; i < this.count; i++) {
        const x = center.x + (S[i * 3] - 0.5) * BOX
        const z = center.z + (S[i * 3 + 2] - 0.5) * BOX
        const y = center.y - 10 + ((((S[i * 3 + 1] * TOP - t * 38) % TOP) + TOP) % TOP)
        arr.set([x, y, z, x + 0.15, y + 1.1, z + 0.05], i * 6)
      }
      this.rain.geometry.attributes.position.needsUpdate = true
    } else {
      const arr = (this.snow.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array
      for (let i = 0; i < this.count; i++) {
        const sx = S[i * 3], sz = S[i * 3 + 2]
        const x = center.x + (sx - 0.5) * BOX + Math.sin(t * 0.8 + sz * 30) * 0.8
        const z = center.z + (sz - 0.5) * BOX + Math.cos(t * 0.6 + sx * 30) * 0.8
        const y = center.y - 10 + ((((S[i * 3 + 1] * TOP - t * 2.2) % TOP) + TOP) % TOP)
        arr[i * 3] = x
        arr[i * 3 + 1] = y
        arr[i * 3 + 2] = z
      }
      this.snow.geometry.attributes.position.needsUpdate = true
    }
  }
}
