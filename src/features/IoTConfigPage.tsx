import { useEffect, useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'
import type { IoTDeviceDTO, ChannelKind } from '../mock/types'

const CH_LABEL: Record<ChannelKind, string> = { wechat: '企业微信', dingtalk: '钉钉', email: '邮件', 'sms-aliyun': '阿里云短信', 'sms-tencent': '腾讯云短信' }
const STAT_COLOR: Record<string, string> = { online: '#4ade80', offline: '#9fb0c3', alarm: '#ff8585' }

/** 物联组态：工业级可视化编辑器 / 设备实时状态 / 多级联动智能报警 */
export default function IoTConfigPage() {
  const { data: dev, loading, error } = useApi(() => api.listIoTDevices({ pageSize: 50 }), [])
  const { data: alarms } = useApi(() => api.listIoTAlarms({ pageSize: 50 }), [])
  const [live, setLive] = useState<IoTDeviceDTO[]>([])

  useEffect(() => { if (dev?.list) setLive(dev.list) }, [dev])
  // 模拟实时指标跳动
  useEffect(() => {
    const t = setInterval(() => {
      setLive((prev) => prev.map((d) => {
        if (d.status === 'offline') return d
        const metrics: Record<string, number> = {}
        for (const k of Object.keys(d.metrics)) metrics[k] = Math.max(0, Math.round(d.metrics[k] + (Math.random() - 0.5) * 6))
        return { ...d, metrics }
      }))
    }, 2000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">物联组态</h2><p className="fp-sub">工业级可视化组态编辑器 · 设备实时状态监控 · 多级联动智能报警</p></div>
        <span className="fp-count">设备 {live.length} 台</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <div className="grid3" style={{ marginBottom: 16 }}>
          {live.map((d) => (
            <div key={d.id} className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <b style={{ color: '#e6edf3' }}>{d.name}</b>
                <span className={'status-dot ' + (d.status === 'online' ? 'active' : d.status === 'alarm' ? 'disabled' : '')}>{STAT_COLOR[d.status]} {d.status}</span>
              </div>
              <div className="muted2" style={{ margin: '8px 0' }}>{d.type}</div>
              <div className="flex">
                {Object.entries(d.metrics).map(([k, v]) => <Tag key={k}>{k}:{v}</Tag>)}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <b style={{ color: '#e6edf3' }}>多级联动智能报警规则</b>
        <table className="data-table" style={{ marginTop: 10 }}>
          <thead><tr><th>设备</th><th>指标</th><th>条件</th><th>级别</th><th>推送通道</th><th>状态</th></tr></thead>
          <tbody>
            {(alarms?.list ?? []).map((a) => (
              <tr key={a.id}>
                <td>{a.deviceName}</td><td className="muted">{a.metric}</td>
                <td className="muted">{a.op} {a.threshold}</td>
                <td><Tag color={a.level === 'critical' ? '#ff8585' : a.level === 'warning' ? '#e0b15a' : '#9fb0c3'}>{a.level}</Tag></td>
                <td className="flex">{a.channels.map((c) => <Tag key={c}>{CH_LABEL[c]}</Tag>)}</td>
                <td><span className={'status-dot ' + (a.enabled ? 'active' : 'disabled')}>{a.enabled ? '启用' : '停用'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
