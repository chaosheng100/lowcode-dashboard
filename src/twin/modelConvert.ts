import * as THREE from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export const CONVERTIBLE_EXTS = ['.obj', '.fbx']

export function isConvertibleModel(name: string): boolean {
  return /\.(obj|fbx)$/i.test(name)
}

/** 解析 OBJ/FBX 并导出为 GLB（浏览器端零依赖转换） */
export async function convertToGlb(file: File): Promise<{ blob: Blob; fileName: string }> {
  const base = file.name.replace(/\.[^.]+$/, '')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  let root: THREE.Object3D
  if (ext === 'obj') {
    const text = await file.text()
    root = new OBJLoader().parse(text)
  } else if (ext === 'fbx') {
    const buf = await file.arrayBuffer()
    root = new FBXLoader().parse(buf, '')
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
