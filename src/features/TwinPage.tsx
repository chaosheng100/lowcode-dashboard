import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'

/** 数字孪生 3D：Three.js 实时场景（日照 / 夜景 / 雾效），预置 91 种 3D 模型组件 */
export default function TwinPage() {
  const { data: models } = useApi(() => api.listTwinModels({ pageSize: 30 }), [])
  const mountRef = useRef<HTMLDivElement>(null)
  const [lighting, setLighting] = useState<'day' | 'night'>('day')
  const [fog, setFog] = useState(false)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(lighting === 'day' ? '#0a1422' : '#05080f')
    if (fog) scene.fog = new THREE.FogExp2(lighting === 'day' ? '#0a1422' : '#05080f', 0.045)

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 100)
    camera.position.set(6, 5, 8)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    el.appendChild(renderer.domElement)

    // 光照：日照 / 夜景
    const ambient = new THREE.AmbientLight(0xffffff, lighting === 'day' ? 0.9 : 0.25)
    scene.add(ambient)
    const dir = new THREE.DirectionalLight(lighting === 'day' ? 0xfff2cc : 0x4466ff, lighting === 'day' ? 1.1 : 0.6)
    dir.position.set(5, 8, 5)
    scene.add(dir)

    // 场景：建筑 / 设备 占位（演示用基元）
    const group = new THREE.Group()
    const colors = [0x4f8cff, 0x22d3ee, 0xa855f7, 0x4ade80]
    for (let i = 0; i < 16; i++) {
      const h = 0.6 + (i % 5) * 0.4
      const geo = i % 3 === 0 ? new THREE.CylinderGeometry(0.3, 0.3, h, 16) : new THREE.BoxGeometry(0.7, h, 0.7)
      const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], metalness: 0.3, roughness: 0.6 })
      const m = new THREE.Mesh(geo, mat)
      m.position.set((i % 4) * 1.6 - 2.4, h / 2, Math.floor(i / 4) * 1.6 - 2.4)
      group.add(m)
    }
    // 地面
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x0d1a2b, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    group.add(ground)
    scene.add(group)

    let raf = 0
    const animate = () => {
      group.rotation.y += 0.003
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      if (!el) return
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
    }
  }, [lighting, fog])

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">数字孪生 3D</h2><p className="fp-sub">拖拽式场景搭建 · 悬浮数据卡 · 关键帧轨迹 · 日照/夜景/雾效 · 91 种预置模型</p></div>
        <span className="fp-count">预置模型 91 种</span>
      </div>
      <div className="grid2">
        <div>
          <div className="flex" style={{ marginBottom: 10 }}>
            <button className={'btn sm' + (lighting === 'day' ? ' sel-btn' : '')} onClick={() => setLighting('day')}>☀ 日照</button>
            <button className={'btn sm' + (lighting === 'night' ? ' sel-btn' : '')} onClick={() => setLighting('night')}>🌙 夜景</button>
            <button className={'btn sm' + (fog ? ' sel-btn' : '')} onClick={() => setFog((v) => !v)}>🌫 雾效 {fog ? '开' : '关'}</button>
          </div>
          <div ref={mountRef} style={{ width: '100%', height: 380, background: '#05080f', borderRadius: 10, border: '1px solid #1a2433', overflow: 'hidden' }} />
        </div>
        <div>
          <div className="muted2" style={{ marginBottom: 8 }}>模型库（节选，共 91 种预置）</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, maxHeight: 380, overflow: 'auto' }}>
            {(models?.list ?? []).map((m) => (
              <div key={m.id} className="card" style={{ padding: 6, textAlign: 'center' }}>
                <img src={m.thumbnail} alt={m.name} width={48} height={48} style={{ borderRadius: 6 }} />
                <div className="muted2" style={{ fontSize: 11, marginTop: 4 }}>{m.name}</div>
                <Tag>{m.category}</Tag>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
