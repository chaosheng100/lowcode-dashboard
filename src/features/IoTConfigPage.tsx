import { useEffect, useState } from 'react'
import PluginManagement from './PluginManagement'
import { api } from '../mock'
import type { IoTDeviceDTO } from '../mock/types'
import { Tag } from './common'

const STATUS_LABEL: Record<string, string> = { online: '在线', offline: '离线', alarm: '告警' }
const STATUS_COLOR: Record<string, string> = { online: '#4ade80', offline: '#9aa7b4', alarm: '#ff6b6b' }

/** 物联组态：设备列表 + 配置编辑 + 实时监控预览（关系与大屏管理一致） */
export default function IoTConfigPage() {
  return (
    <PluginManagement<IoTDeviceDTO>
      title="物联组态"
      subtitle="工业组态设备管理 · 配置设备指标 · 实时监控预览"
      countLabel="设备"
      fetcher={() => api.listIoTDevices({ pageSize: 50 })}
      saveItem={(b) => api.saveIoTDevice(b)}
      deleteItem={(id) => api.deleteIoTDevice(id)}
      blankItem={() => ({ id: '', name: '新设备', type: 'sensor', status: 'online', metrics: { temperature: 0, humidity: 0 }, updatedAt: '' })}
      renderMeta={(d) => [`类型：${d.type}`, `状态：${STATUS_LABEL[d.status] ?? d.status}`]}
      renderTags={(d) => <Tag color={STATUS_COLOR[d.status]}>{STATUS_LABEL[d.status] ?? d.status}</Tag>}
      renderEditor={(d, save) => <DeviceEditor item={d} save={save} />}
      renderPreview={(d) => <DeviceMonitor item={d} />}
    />
  )
}

function DeviceEditor({ item, save }: { item: IoTDeviceDTO; save: (p: Partial<IoTDeviceDTO>) => Promise<void> }) {
  const [name, setName] = useState(item.name)
  const [type, setType] = useState(item.type)
  const [status, setStatus] = useState<IoTDeviceDTO['status']>(item.status)
  const [metricsText, setMetricsText] = useState(
    Object.entries(item.metrics).map(([k, v]) => `${k}:${v}`).join('\n')
  )
  const [saving, setSaving] = useState(false)

  const doSave = async () => {
    setSaving(true)
    const metrics: Record<string, number> = {}
    metricsText.split('\n').forEach((line) => {
      const [k, v] = line.split(/[:：]/)
      if (k?.trim()) metrics[k.trim()] = Number(v) || 0
    })
    await save({ name, type, status, metrics })
    setSaving(false)
  }

  return (
    <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="field"><label>设备名称</label><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="row2">
        <div className="field"><label>类型</label><input className="inp" value={type} onChange={(e) => setType(e.target.value)} /></div>
        <div className="field"><label>状态</label>
          <select className="inp" value={status} onChange={(e) => setStatus(e.target.value as IoTDeviceDTO['status'])}>
            <option value="online">在线</option><option value="offline">离线</option><option value="alarm">告警</option>
          </select>
        </div>
      </div>
      <div className="field"><label>指标（每行 key:value，如 temperature:36.5）</label><textarea className="inp" style={{ minHeight: 160 }} value={metricsText} onChange={(e) => setMetricsText(e.target.value)} /></div>
      <div className="fp-toolbar"><button className="btn primary" onClick={doSave} disabled={saving}>{saving ? '保存中…' : '保存'}</button></div>
    </div>
  )
}

function DeviceMonitor({ item }: { item: IoTDeviceDTO }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500)
    return () => clearInterval(id)
  }, [])
  const entries = Object.entries(item.metrics)
  return (
    <div style={{ height: '100%' }}>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <b style={{ color: '#e6edf3', fontSize: 18 }}>{item.name}</b>
        <Tag color={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status] ?? item.status} · 实时</Tag>
      </div>
      <div className="grid3">
        {entries.map(([k, v]) => {
          // 模拟实时跳动
          const live = Number(v) + Math.round(Math.sin(tick + k.length) * 5 * 10) / 10
          const pct = Math.min(100, Math.max(0, (live / (Math.max(1, live * 2))) * 100))
          return (
            <div className="card" key={k}>
              <div className="muted2">{k}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#00d4ff', margin: '6px 0' }}>{live.toFixed(1)}</div>
              <div style={{ height: 6, background: '#1a2433', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#00d4ff,#4f8cff)', transition: 'width .6s' }} />
              </div>
            </div>
          )
        })}
        {!entries.length && <div className="empty-tip">该设备无指标</div>}
      </div>
    </div>
  )
}
