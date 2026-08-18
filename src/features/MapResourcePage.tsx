import { useState } from 'react'
import { Alert, Button, InputNumber, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import EChartBox from './EChartBox'
import { Modal, Field, Input, Select, Tag } from './common'
import type { MapResourceDTO, MapProvider } from '../mock/types'

const PROVIDER_LABEL: Record<MapProvider, string> = {
  echart: 'EChart 地图', gaode: '高德地图', baidu: '百度地图', tencent: '腾讯地图', custom: '任意三方地图'
}
const PROVIDERS: MapProvider[] = ['echart', 'gaode', 'baidu', 'tencent', 'custom']

/** 地图资源：EChart / 高德 / 百度 / 腾讯 / 任意三方地图，作为画布地理可视化底图 */
export default function MapResourcePage() {
  const { data, loading, error, reload } = useApi(() => api.listMaps({ pageSize: 50 }), [])
  const [editing, setEditing] = useState<Partial<MapResourceDTO> | null>(null)

  const save = async () => { if (!editing) return; await api.saveMap(editing); setEditing(null); reload() }
  const remove = async (id: string) => { await api.deleteMap(id); reload() }
  const sel = data?.list?.[0]

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">地图资源</h2>
          <p className="fp-sub">EChart / 高德 / 百度 / 腾讯 / 任意三方地图底图，画布地理可视化来源</p>
        </div>
        <Button onClick={() => setEditing({ name: '', provider: 'echart', center: [104, 35], zoom: 1 })}>＋ 新建地图</Button>
      </div>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin /></div>}
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 10 }} />}
      {!loading && !error && (
        <div className="grid2">
          <div>
            {(data?.list ?? []).map((m) => (
              <div key={m.id} className="card" style={{ marginBottom: 12 }}>
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <b style={{ color: '#1d1d1f' }}>{m.name}</b><Tag>{PROVIDER_LABEL[m.provider]}</Tag>
                </div>
                <div className="muted2" style={{ margin: '6px 0' }}>中心 {m.center?.join(', ') ?? '—'} · 缩放 {m.zoom}</div>
                <div className="fp-toolbar" style={{ marginTop: 6 }}>
                  <Button size="small" onClick={() => setEditing(m)}>编辑</Button>
                  <Button size="small" danger onClick={() => remove(m.id)}>删除</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="muted2" style={{ marginBottom: 8 }}>地图预览（{sel ? PROVIDER_LABEL[sel.provider] : '—'}）</div>
            {sel?.provider === 'echart' ? (
              <EChartBox height={280} option={{
                title: { text: '区域指标分布', textStyle: { color: '#86868b', fontSize: 13 } },
                xAxis: { type: 'category', data: ['华东', '华北', '华南', '西部'], axisLabel: { color: '#86868b' } },
                yAxis: { type: 'value', splitLine: { lineStyle: { color: '#e5e5ea' } } },
                series: [{ type: 'bar', data: [320, 210, 260, 150], itemStyle: { color: '#0a84ff', borderRadius: [4, 4, 0, 0] } }]
              }} />
            ) : (
              <div style={{ height: 280, background: 'repeating-linear-gradient(0deg,#f5f5f7,#f5f5f7 19px,#e8e8ed 20px),repeating-linear-gradient(90deg,#f5f5f7,#f5f5f7 19px,#e8e8ed 20px)', borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 12, height: 12, background: '#ff3b30', borderRadius: '50%', transform: 'translate(-50%,-50%)', boxShadow: '0 0 0 4px rgba(255,59,48,0.12)' }} />
                <div style={{ position: 'absolute', left: 12, bottom: 10, color: '#86868b', fontSize: 12 }}>{sel ? PROVIDER_LABEL[sel.provider] : '请选择地图'}</div>
              </div>
            )}
          </div>
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? '编辑地图' : '新建地图'} onClose={() => setEditing(null)}>
          <Field label="名称"><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="地图服务商">
            <Select value={editing.provider || 'echart'} onChange={(e) => setEditing({ ...editing, provider: e.target.value as MapProvider })}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
            </Select>
          </Field>
          <Field label="AccessKey"><Input value={editing.key || ''} onChange={(e) => setEditing({ ...editing, key: e.target.value })} placeholder="三方地图 Key（可选）" /></Field>
          <Field label="经度"><InputNumber style={{ width: '100%' }} value={editing.center?.[0] ?? 104} onChange={(v) => setEditing({ ...editing, center: [v ?? 0, editing.center?.[1] ?? 35] })} /></Field>
          <Field label="纬度"><InputNumber style={{ width: '100%' }} value={editing.center?.[1] ?? 35} onChange={(v) => setEditing({ ...editing, center: [editing.center?.[0] ?? 104, v ?? 0] })} /></Field>
          <div className="fp-toolbar"><Button onClick={save}>保存</Button></div>
        </Modal>
      )}
    </div>
  )
}
