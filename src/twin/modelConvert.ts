import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { ifcToGlb } from './ifcConvert'
import { buildScene, toGLB } from 'openskp'

export const CONVERTIBLE_EXTS = ['.obj', '.fbx', '.dae', '.ifc', '.skp']

export function isConvertibleModel(name: string): boolean {
  return /\.(obj|fbx|dae|ifc|skp|pts|xyz)$/i.test(name)
}

function pad4(buf: Uint8Array, fill: number): Uint8Array {
  const rem = buf.length % 4
  if (!rem) return buf
  const out = new Uint8Array(buf.length + 4 - rem)
  out.set(buf)
  out.fill(fill, buf.length)
  return out
}

/** 解析 .pts/.xyz 点云文本为 GLB（POINTS 图元），浏览器端零依赖 */
export function ptsToGlb(file: File): Promise<{ blob: Blob; fileName: string }> {
  return file.text().then((text) => {
    const positions: number[] = []
    const colors: number[] = []
    const maxPoints = 400000
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const parts = line.split(/[\s,]+/).filter(Boolean)
      const nums = parts.map(Number)
      if (nums.length < 3 || nums.slice(0, 3).some((n) => !Number.isFinite(n))) continue
      positions.push(nums[0], nums[1], nums[2])
      let r = 255
      let g = 255
      let b = 255
      if (nums.length >= 6 && [4, 5, 6].every((i) => Number.isFinite(nums[i]))) {
        const maxC = Math.max(nums[4], nums[5], nums[6])
        const scale = maxC > 1 ? 1 : 255
        r = Math.max(0, Math.min(255, Math.round(nums[3] * scale)))
        g = Math.max(0, Math.min(255, Math.round(nums[4] * scale)))
        b = Math.max(0, Math.min(255, Math.round(nums[5] * scale)))
      }
      colors.push(r, g, b)
      if (positions.length / 3 >= maxPoints) break
    }
    if (!positions.length) throw new Error('点云文件没有有效点')

    const count = positions.length / 3
    const posBuf = new Float32Array(positions)
    const colBuf = new Uint8Array(colors)
    const minX = Math.min(...positions.filter((_, i) => i % 3 === 0))
    const minY = Math.min(...positions.filter((_, i) => i % 3 === 1))
    const minZ = Math.min(...positions.filter((_, i) => i % 3 === 2))
    const maxX = Math.max(...positions.filter((_, i) => i % 3 === 0))
    const maxY = Math.max(...positions.filter((_, i) => i % 3 === 1))
    const maxZ = Math.max(...positions.filter((_, i) => i % 3 === 2))

    const base = file.name.replace(/\.[^.]+$/, '')
    const json = {
      asset: { version: '2.0', generator: 'codex-point-cloud' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: base }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 }, mode: 0, material: 0 }] }],
      materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } }],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count,
          type: 'VEC3',
          min: [minX, minY, minZ],
          max: [maxX, maxY, maxZ]
        },
        { bufferView: 1, componentType: 5121, count, type: 'VEC3', normalized: true }
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: posBuf.byteLength },
        { buffer: 0, byteOffset: posBuf.byteLength, byteLength: colBuf.byteLength }
      ],
      buffers: [{ byteLength: posBuf.byteLength + colBuf.byteLength }]
    }
    const jsonBuf = pad4(new TextEncoder().encode(JSON.stringify(json)), 0x20)
    const binRaw = new Uint8Array(posBuf.byteLength + colBuf.byteLength)
    binRaw.set(new Uint8Array(posBuf.buffer), 0)
    binRaw.set(colBuf, posBuf.byteLength)
    const binBuf = pad4(binRaw, 0)

    const header = new Uint8Array(12)
    const dv = new DataView(header.buffer)
    dv.setUint32(0, 0x46546c67, true)
    dv.setUint32(4, 2, true)
    dv.setUint32(8, 12 + 8 + jsonBuf.length + 8 + binBuf.length, true)
    const jsonChunk = new Uint8Array(8)
    const jv = new DataView(jsonChunk.buffer)
    jv.setUint32(0, jsonBuf.length, true)
    jv.setUint32(4, 0x4e4f534a, true)
    const binChunk = new Uint8Array(8)
    const bv = new DataView(binChunk.buffer)
    bv.setUint32(0, binBuf.length, true)
    bv.setUint32(4, 0x004e4942, true)

    const glb = new Uint8Array(header.length + jsonChunk.length + jsonBuf.length + binChunk.length + binBuf.length)
    let off = 0
    for (const part of [header, jsonChunk, jsonBuf, binChunk, binBuf]) {
      glb.set(part, off)
      off += part.length
    }
    return { blob: new Blob([glb], { type: 'model/gltf-binary' }), fileName: `${base}.glb` }
  })
}

/** 解析 OBJ/FBX 并导出为 GLB（浏览器端零依赖转换） */
export async function convertToGlb(file: File): Promise<{ blob: Blob; fileName: string }> {
  const base = file.name.replace(/\.[^.]+$/, '')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pts' || ext === 'xyz') return ptsToGlb(file)
  if (ext === 'ifc') {
    const buf = await file.arrayBuffer()
    return ifcToGlb(buf)
  }
  if (ext === 'skp') {
    const buf = await file.arrayBuffer()
    const glb = new Uint8Array(toGLB(buildScene(buf)))
    return { blob: new Blob([glb.buffer as ArrayBuffer], { type: 'model/gltf-binary' }), fileName: `${base}.glb` }
  }
  let root: THREE.Object3D
  if (ext === 'obj') {
    const text = await file.text()
    root = new OBJLoader().parse(text)
  } else if (ext === 'fbx') {
    const buf = await file.arrayBuffer()
    root = new FBXLoader().parse(buf, '')
  } else if (ext === 'dae') {
    const text = await file.text()
    const collada = new ColladaLoader().parse(text, '')
    root = collada.scene
  } else {
    throw new Error('不支持的转换格式')
  }

  const box = new THREE.Box3().setFromObject(root)
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3())
    root.position.sub(center)
  }
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (mat && mat.type === 'MeshPhongMaterial') {
      const phong = mat as THREE.MeshPhongMaterial
      mesh.material = new THREE.MeshStandardMaterial({
        color: phong.color,
        map: phong.map ?? undefined,
        metalness: 0.1,
        roughness: 0.8
      })
    }
  })

  const scene = new THREE.Scene()
  scene.add(root)
  const exporter = new GLTFExporter()
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(scene, (r) => resolve(r as ArrayBuffer), reject, { binary: true })
  })
  return { blob: new Blob([buf], { type: 'model/gltf-binary' }), fileName: `${base}.glb` }
}
