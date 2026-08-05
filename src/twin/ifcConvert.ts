import * as THREE from 'three'
import * as WebIFC from 'web-ifc'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

let apiPromise: Promise<WebIFC.IfcAPI> | null = null

async function getApi(): Promise<WebIFC.IfcAPI> {
  if (!apiPromise) {
    apiPromise = (async () => {
      const api = new WebIFC.IfcAPI()
      api.SetWasmPath('/ifc/', true)
      await api.Init()
      return api
    })()
  }
  return apiPromise
}

/** 用 web-ifc 解析 IFC 并导出为 GLB（BIM 接入） */
export async function ifcToGlb(buffer: ArrayBuffer): Promise<{ blob: Blob; fileName: string }> {
  const api = await getApi()
  const modelID = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true })
  const scene = new THREE.Scene()
  try {
    const meshes = api.LoadAllGeometry(modelID)
    for (let i = 0; i < meshes.size(); i++) {
      const flat = meshes.get(i)
      const group = new THREE.Group()
      for (let j = 0; j < flat.geometries.size(); j++) {
        const placed = flat.geometries.get(j)
        const geom = api.GetGeometry(modelID, placed.geometryExpressID)
        const vData = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize())
        const iData = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize())
        const vertexCount = Math.floor(vData.length / 6)
        if (vertexCount > 0 && iData.length > 0) {
          const positions = new Float32Array(vertexCount * 3)
          const normals = new Float32Array(vertexCount * 3)
          for (let k = 0; k < vertexCount; k++) {
            positions[k * 3] = vData[k * 6]
            positions[k * 3 + 1] = vData[k * 6 + 1]
            positions[k * 3 + 2] = vData[k * 6 + 2]
            normals[k * 3] = vData[k * 6 + 3]
            normals[k * 3 + 1] = vData[k * 6 + 4]
            normals[k * 3 + 2] = vData[k * 6 + 5]
          }
          const geo = new THREE.BufferGeometry()
          geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
          geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
          geo.setIndex(new THREE.BufferAttribute(iData, 1))
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(placed.color.x, placed.color.y, placed.color.z),
            side: THREE.DoubleSide
          })
          const mesh = new THREE.Mesh(geo, mat)
          mesh.applyMatrix4(new THREE.Matrix4().fromArray(placed.flatTransformation))
          group.add(mesh)
        }
      }
      if (group.children.length) {
        group.name = `IFC_${flat.expressID}`
        scene.add(group)
      }
    }

    const box = new THREE.Box3().setFromObject(scene)
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3())
      scene.position.sub(center)
    }
    const exporter = new GLTFExporter()
    const out = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(scene, (r) => resolve(r as ArrayBuffer), reject, { binary: true })
    })
    return { blob: new Blob([out], { type: 'model/gltf-binary' }), fileName: 'model.glb' }
  } finally {
    api.CloseModel(modelID)
  }
}
