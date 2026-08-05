import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = mesh.material
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
    else if (mat) mat.dispose()
  })
}

/** Load a GLB/GLTF into an offscreen renderer and return a PNG data URL. */
export async function generateModelThumbnail(url: string): Promise<string> {
  let renderer: THREE.WebGLRenderer | null = null
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(240, 240)
    renderer.setClearColor(0x0f172a, 1)

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(3, 5, 4)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xbfdbfe, 0.9)
    fill.position.set(-4, 2, -3)
    scene.add(fill)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
    const model = await new Promise<THREE.Group>((resolve, reject) => {
      const loader = new GLTFLoader()
      const draco = new DRACOLoader()
      draco.setDecoderPath('/draco/')
      loader.setDRACOLoader(draco)
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, (err) => reject(err))
    })
    scene.add(model)

    const box = new THREE.Box3().setFromObject(model)
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.01)
    const dist = (maxDim / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.35
    camera.position.set(center.x + dist, center.y + dist * 0.7, center.z + dist)
    camera.lookAt(center)

    renderer.render(scene, camera)
    const dataUrl = renderer.domElement.toDataURL('image/png')
    disposeObject(model)
    renderer.dispose()
    return dataUrl
  } catch {
    renderer?.dispose()
    return ''
  }
}
