import { useEffect } from 'react'
import * as THREE from 'three'
import { Canvas, useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

function CameraRig() {
  const { camera, gl } = useThree()
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 0.5
    controls.maxDistance = 24
    return () => controls.dispose()
  }, [camera, gl])
  return null
}

function FitModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder)
  })
  return (
    <primitive
      object={gltf.scene}
      onUpdate={(obj: THREE.Object3D) => {
        const box = new THREE.Box3().setFromObject(obj)
        if (box.isEmpty()) return
        const size = box.getSize(new THREE.Vector3())
        const max = Math.max(size.x, size.y, size.z)
        const scale = max > 0 ? Math.min(1.5 / max, 8) : 1
        obj.scale.setScalar(scale)
        box.setFromObject(obj)
        obj.position.sub(box.getCenter(new THREE.Vector3()))
      }}
    />
  )
}

export default function ModelPreview3D({ url, height = 360 }: { url: string; height?: number }) {
  return (
    <div
      style={{
        width: '100%',
        height,
        position: 'relative',
        background: 'radial-gradient(circle at 50% 40%, rgba(20,40,70,.8), rgba(5,10,20,.9))'
      }}
    >
      <Canvas
        camera={{ position: [2.2, 1.8, 2.6], fov: 45 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 3]} intensity={1.4} />
        <directionalLight position={[-4, -2, -3]} intensity={0.3} />
        <FitModel url={url} />
        <CameraRig />
      </Canvas>
    </div>
  )
}
