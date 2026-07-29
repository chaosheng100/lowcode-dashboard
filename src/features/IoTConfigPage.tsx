import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, InputNumber, Popconfirm, Select, Spin, Switch } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { api } from '../mock'
import type { AlarmLevel, ChannelKind, IoTAlarmRuleDTO, IoTDeviceDTO } from '../mock/types'
import type { RouteConfig } from '../data/types'
import { useDesignerStore } from '../data/store/useDesignerStore'
import { broadcastRoute } from '../designer/sync'
import { Empty, Field, Input, Modal, Textarea } from './common'
import { useApi } from './useApi'
import { syncIoTDeviceToDashboard, unlinkIoTFromDashboard } from './iotWidgetCatalog'

const STATUS_LABEL: Record<IoTDeviceDTO['status'], string> = { online: '在线', offline: '离线', alarm: '告警' }
const LEVEL_LABEL: Record<AlarmLevel, string> = { info: '提示', warning: '警告', critical: '严重' }
const CHANNEL_LABEL: Record<ChannelKind, string> = {
  wechat: '企业微信', dingtalk: '钉钉', email: '邮件', 'sms-aliyun': '阿里云短信', 'sms-tencent': '腾讯云短信'
}
const CHANNELS = Object.keys(CHANNEL_LABEL) as ChannelKind[]

interface IoTDashboardBinding {
  deviceId: string
  deviceName: string
  syncedAt: string
}

function dashboardBindings(route: RouteConfig): IoTDashboardBinding[] {
  const value = route.state.iotBindings
  return Array.isArray(value) ? value.filter((item): item is IoTDashboardBinding => Boolean(item && typeof item === 'object' && 'deviceId' in item)) : []
}

function evaluateAlarm(rule: IoTAlarmRuleDTO, value: number | undefined) {
  if (!rule.enabled || value == null) return false
  if (rule.op === '>') return value > rule.threshold
  if (rule.op === '<') return value < rule.threshold
  if (rule.op === '==') return value === rule.threshold
  return value !== rule.threshold
}

export default function IoTConfigPage() {
  const devices = useApi(() => api.listIoTDevices({ pageSize: 100 }), [])
  const alarms = useApi(() => api.listIoTAlarms({ pageSize: 100 }), [])
  const routes = useDesignerStore((state) => state.routes)
  const updateRoute = useDesignerStore((state) => state.updateRoute)
  const selectRoute = useDesignerStore((state) => state.selectRoute)
  const dashboards = useMemo(() => routes.filter((route) => route.kind === 'dashboard'), [routes])
  const pushDashboardUpdate = (route: RouteConfig, patch: Partial<RouteConfig>) => {
    const nextRoute = { ...route, ...patch }
    updateRoute(route.id, patch)
    broadcastRoute(nextRoute)
  }
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | IoTDeviceDTO['status']>('all')
  const [deviceEditor, setDeviceEditor] = useState<IoTDeviceDTO | null | 'new'>(null)
  const [alarmEditor, setAlarmEditor] = useState(false)
  const [deployOpen, setDeployOpen] = useState(false)
  const [dashboardId, setDashboardId] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const deviceList = devices.data?.list ?? []
  const selected = deviceList.find((device) => device.id === selectedId) ?? deviceList[0] ?? null
  const deviceAlarms = (alarms.data?.list ?? []).filter((rule) => rule.deviceId === selected?.id)
  const linkedDashboards = selected
    ? dashboards.filter((route) => dashboardBindings(route).some((binding) => binding.deviceId === selected.id))
    : []
  const filteredDevices = deviceList.filter((device) => {
    const matchesKeyword = !keyword.trim() || device.name.toLowerCase().includes(keyword.trim().toLowerCase()) || device.type.toLowerCase().includes(keyword.trim().toLowerCase())
    return matchesKeyword && (statusFilter === 'all' || device.status === statusFilter)
  })
  const online = deviceList.filter((device) => device.status === 'online').length
  const alarmCount = deviceList.filter((device) => device.status === 'alarm').length

  useEffect(() => {
    if (!selectedId && deviceList[0]) setSelectedId(deviceList[0].id)
  }, [deviceList, selectedId])

  const saveDevice = async (patch: Partial<IoTDeviceDTO>) => {
    setBusy(true)
    const response = await api.saveIoTDevice(patch)
    if (response.code !== 0) {
      setNotice(response.message)
      setBusy(false)
      return
    }
    for (const route of dashboards) {
      if (dashboardBindings(route).some((binding) => binding.deviceId === response.data.id)) {
        pushDashboardUpdate(route, syncIoTDeviceToDashboard(route, response.data, new Date().toISOString()))
      }
    }
    setSelectedId(response.data.id)
    setDeviceEditor(null)
    setNotice('设备配置已保存，关联大屏已同步更新')
    devices.reload()
    setBusy(false)
  }

  const deleteDevice = async (device: IoTDeviceDTO) => {
    setBusy(true)
    const response = await api.deleteIoTDevice(device.id)
    if (response.code === 0) {
      for (const rule of (alarms.data?.list ?? []).filter((item) => item.deviceId === device.id)) await api.deleteIoTAlarm(rule.id)
      dashboards.forEach((route) => {
        if (!dashboardBindings(route).some((binding) => binding.deviceId === device.id)) return
        pushDashboardUpdate(route, unlinkIoTFromDashboard(route, device.id))
      })
      setSelectedId(null)
      devices.reload()
      alarms.reload()
      setNotice('设备及关联配置已删除')
    } else setNotice(response.message)
    setBusy(false)
  }

  const bindDashboard = () => {
    if (!selected || !dashboardId) return
    const route = dashboards.find((item) => item.id === dashboardId)
    if (!route) return
    pushDashboardUpdate(route, syncIoTDeviceToDashboard(route, selected, new Date().toISOString()))
    setDashboardId('')
    setDeployOpen(false)
    setNotice(`已将「${selected.name}」投放到「${route.name}」`)
  }

  const unbindDashboard = (route: RouteConfig) => {
    if (!selected) return
    pushDashboardUpdate(route, unlinkIoTFromDashboard(route, selected.id))
    setNotice(`已解除与「${route.name}」的关联`)
  }

  const saveAlarm = async (patch: Partial<IoTAlarmRuleDTO>) => {
    setBusy(true)
    const response = await api.saveIoTAlarm(patch)
    if (response.code === 0) {
      alarms.reload()
      setAlarmEditor(false)
      setNotice('告警规则已保存')
    } else setNotice(response.message)
    setBusy(false)
  }

  const toggleAlarm = async (rule: IoTAlarmRuleDTO) => {
    const response = await api.saveIoTAlarm({ id: rule.id, enabled: !rule.enabled })
    if (response.code === 0) alarms.reload()
    else setNotice(response.message)
  }

  const deleteAlarm = async (rule: IoTAlarmRuleDTO) => {
    const response = await api.deleteIoTAlarm(rule.id)
    if (response.code === 0) alarms.reload()
    else setNotice(response.message)
  }

  return (
    <main className="feature-page iot-page">
      <header className="iot-head">
        <div><h1 className="fp-title">物联组态</h1><p className="fp-sub">统一管理设备、指标、告警，并将实时数据同步到大屏</p></div>
        <div className="iot-head-actions">
          <Button onClick={() => selectRoute('/dashboard')}>大屏管理</Button>
          <Button type="primary" onClick={() => setDeviceEditor('new')}>+ 新建设备</Button>
        </div>
      </header>

      <section className="iot-summary" aria-label="物联设备概览">
        <div><strong>{deviceList.length}</strong><span>设备总数</span></div>
        <div><strong>{online}</strong><span>在线设备</span></div>
        <div className="warning"><strong>{alarmCount}</strong><span>告警设备</span></div>
        <div><strong>{dashboards.filter((route) => dashboardBindings(route).length).length}</strong><span>关联大屏</span></div>
      </section>

      {notice && <Alert type="info" message={notice} showIcon closable onClose={() => setNotice(null)} style={{ marginBottom: 12 }} />}
      {(devices.loading || alarms.loading) && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin /></div>}
      {(devices.error || alarms.error) && <Alert type="error" message={devices.error || alarms.error} showIcon style={{ marginBottom: 10 }} />}

      {!devices.loading && !devices.error && (
        <div className="iot-workspace">
          <aside className="iot-device-panel">
            <div className="iot-panel-head"><div><h2>设备资产</h2><span>{filteredDevices.length} 台</span></div></div>
            <div className="iot-device-filters">
              <Input aria-label="搜索设备" placeholder="搜索名称或类型" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              <Select
                aria-label="设备状态"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'online', label: '在线' },
                  { value: 'offline', label: '离线' },
                  { value: 'alarm', label: '告警' }
                ]}
                style={{ width: '100%' }}
              />
            </div>
            <div className="iot-device-list">
              {filteredDevices.map((device) => (
                <button key={device.id} className={selected?.id === device.id ? 'iot-device-item active' : 'iot-device-item'} onClick={() => setSelectedId(device.id)}>
                  <span className={`iot-status-dot ${device.status}`} />
                  <span><strong>{device.name}</strong><small>{device.type} · {Object.keys(device.metrics).length} 个指标</small></span>
                  <em>{STATUS_LABEL[device.status]}</em>
                </button>
              ))}
              {!filteredDevices.length && <Empty>没有匹配的设备</Empty>}
            </div>
          </aside>

          <section className="iot-detail">
            {selected ? <>
              <div className="iot-detail-head">
                <div><div className="iot-device-title"><h2>{selected.name}</h2><span className={`iot-device-state ${selected.status}`}>{STATUS_LABEL[selected.status]}</span></div><p>{selected.type} · 更新于 {selected.updatedAt}</p></div>
                <div>
                  <Button type="primary" onClick={() => { setDashboardId(dashboards.filter((route) => !linkedDashboards.some((linked) => linked.id === route.id))[0]?.id ?? ''); setDeployOpen(true) }}>投放到大屏</Button>
                  <Button onClick={() => setDeviceEditor(selected)}>编辑</Button>
                  <Popconfirm title={`确定删除「${selected.name}」？相关告警与大屏绑定将一并清理。`} onConfirm={() => deleteDevice(selected)}>
                    <Button danger disabled={busy}>删除</Button>
                  </Popconfirm>
                </div>
              </div>

              <section className="iot-metrics" aria-label="实时指标">
                <div className="iot-section-head"><div><h3>实时指标</h3><p>设备当前采集值</p></div><span>{Object.keys(selected.metrics).length} 项</span></div>
                <div className="iot-metric-grid">
                  {Object.entries(selected.metrics).map(([metric, value]) => {
                    const triggered = deviceAlarms.some((rule) => rule.metric === metric && evaluateAlarm(rule, value))
                    return <article key={metric} className={triggered ? 'iot-metric-card alarm' : 'iot-metric-card'}><span>{metric}</span><strong>{value.toLocaleString()}</strong><small>{triggered ? '已触发告警' : '采集正常'}</small></article>
                  })}
                  {!Object.keys(selected.metrics).length && <Empty>该设备尚未配置指标</Empty>}
                </div>
              </section>

              <div className="iot-detail-grid">
                <section className="iot-subpanel">
                  <div className="iot-section-head"><div><h3>告警规则</h3><p>满足条件时标记指标异常</p></div><Button size="small" onClick={() => setAlarmEditor(true)} disabled={!Object.keys(selected.metrics).length}>+ 新建规则</Button></div>
                  <div className="iot-alarm-list">
                    {deviceAlarms.map((rule) => <div className="iot-alarm-row" key={rule.id}>
                      <span className={`iot-level ${rule.level}`}>{LEVEL_LABEL[rule.level]}</span>
                      <div><strong>{rule.metric} {rule.op} {rule.threshold}</strong><small>{rule.channels.map((channel) => CHANNEL_LABEL[channel]).join('、') || '仅站内告警'}</small></div>
                      <Switch size="small" checked={rule.enabled} aria-label={rule.enabled ? '停用告警' : '启用告警'} onChange={() => toggleAlarm(rule)} />
                      <Popconfirm title="确定删除该告警规则？" onConfirm={() => deleteAlarm(rule)}>
                        <Button type="text" size="small" danger icon={<CloseOutlined />} aria-label="删除告警" />
                      </Popconfirm>
                    </div>)}
                    {!deviceAlarms.length && <Empty>尚未配置告警规则</Empty>}
                  </div>
                </section>

                <section className="iot-subpanel">
                  <div className="iot-section-head"><div><h3>关联大屏</h3><p>同步设备状态与指标卡</p></div><span>{linkedDashboards.length} 个</span></div>
                  <div className="iot-bind-row">
                    <Button type="primary" block onClick={() => { setDashboardId(dashboards.filter((route) => !linkedDashboards.some((linked) => linked.id === route.id))[0]?.id ?? ''); setDeployOpen(true) }}>投放到大屏</Button>
                  </div>
                  <div className="iot-dashboard-list">
                    {linkedDashboards.map((route) => {
                      const binding = dashboardBindings(route).find((item) => item.deviceId === selected.id)
                      return <div key={route.id}><div><strong>{route.name}</strong><small>同步于 {binding?.syncedAt.slice(0, 16).replace('T', ' ')}</small></div><Button size="small" onClick={() => pushDashboardUpdate(route, syncIoTDeviceToDashboard(route, selected, new Date().toISOString()))}>刷新</Button><Button size="small" onClick={() => window.dispatchEvent(new CustomEvent('dashboard:open-designer', { detail: { routeId: route.id } }))}>打开</Button><Button size="small" danger onClick={() => unbindDashboard(route)}>解绑</Button></div>
                    })}
                    {!linkedDashboards.length && <Empty>投放大屏后，设备组件会自动写入画布</Empty>}
                  </div>
                </section>
              </div>
            </> : <Empty>请选择或新建设备</Empty>}
          </section>
        </div>
      )}

      {deviceEditor && <DeviceModal item={deviceEditor === 'new' ? null : deviceEditor} busy={busy} onClose={() => setDeviceEditor(null)} onSave={saveDevice} />}
      {alarmEditor && selected && <AlarmModal device={selected} busy={busy} onClose={() => setAlarmEditor(false)} onSave={saveAlarm} />}

      {/* 投放到大屏弹窗（与孪生模块一致）：选择目标大屏后生成摘要/指标卡/告警清单组件 */}
      {deployOpen && selected && (
        <Modal title="投放设备到大屏" onClose={() => setDeployOpen(false)}>
          <p style={{ marginTop: 0, color: 'var(--sub)' }}>
            {selected.name} · {selected.type} · {Object.keys(selected.metrics).length} 项指标
          </p>
          <Field label="目标大屏">
            <Select
              style={{ width: '100%' }}
              value={dashboardId || undefined}
              placeholder={dashboards.length ? '请选择大屏' : '暂无可用大屏'}
              onChange={(v) => setDashboardId(v)}
              options={dashboards
                .filter((route) => !linkedDashboards.some((linked) => linked.id === route.id))
                .map((route) => ({ value: route.id, label: `${route.name} · ${route.components.length} 个组件` }))}
            />
          </Field>
          <p style={{ color: 'var(--sub)', fontSize: 12, lineHeight: 1.6 }}>
            投放时将生成设备摘要、各指标卡与告警清单组件并建立绑定；重复投放会原位更新已投组件，保留已调整的布局。
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDeployOpen(false)}>取消</Button>
            <Button type="primary" disabled={!dashboardId} onClick={bindDashboard}>确认投放</Button>
          </div>
        </Modal>
      )}
    </main>
  )
}

function DeviceModal({ item, busy, onClose, onSave }: { item: IoTDeviceDTO | null; busy: boolean; onClose: () => void; onSave: (patch: Partial<IoTDeviceDTO>) => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [type, setType] = useState(item?.type ?? '传感器')
  const [status, setStatus] = useState<IoTDeviceDTO['status']>(item?.status ?? 'online')
  const [metrics, setMetrics] = useState(Object.entries(item?.metrics ?? { 温度: 0 }).map(([key, value]) => `${key}:${value}`).join('\n'))
  const [error, setError] = useState('')
  const submit = () => {
    const cleanName = name.trim()
    if (!cleanName) return setError('请输入设备名称')
    const parsed: Record<string, number> = {}
    for (const line of metrics.split('\n').map((value) => value.trim()).filter(Boolean)) {
      const match = line.match(/^([^:：]+)[:：](-?\d+(?:\.\d+)?)$/)
      if (!match) return setError(`指标格式错误：${line}`)
      parsed[match[1].trim()] = Number(match[2])
    }
    if (!Object.keys(parsed).length) return setError('请至少配置一个指标')
    onSave({ id: item?.id, name: cleanName, type: type.trim() || '设备', status, metrics: parsed })
  }
  return <Modal title={item ? '编辑设备' : '新建设备'} onClose={onClose} width={620}>
    {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 10 }} />}
    <div className="iot-form-grid">
      <Field label="设备名称"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="设备类型"><Input value={type} onChange={(event) => setType(event.target.value)} /></Field>
    </div>
    <Field label="运行状态">
      <Select
        value={status}
        onChange={(v) => setStatus(v as IoTDeviceDTO['status'])}
        options={[{ value: 'online', label: '在线' }, { value: 'offline', label: '离线' }, { value: 'alarm', label: '告警' }]}
        style={{ width: '100%' }}
      />
    </Field>
    <Field label="采集指标">
      <div>
        <Textarea value={metrics} onChange={(event) => setMetrics(event.target.value)} placeholder={'温度:36.5\n压力:8.2'} />
        <div className="muted2" style={{ marginTop: 4, fontSize: 11 }}>每行一个“指标:数值”，支持小数与负数</div>
      </div>
    </Field>
    <div className="iot-modal-actions">
      <Button onClick={onClose}>取消</Button>
      <Button type="primary" loading={busy} onClick={submit}>{busy ? '保存中…' : '保存设备'}</Button>
    </div>
  </Modal>
}

function AlarmModal({ device, busy, onClose, onSave }: { device: IoTDeviceDTO; busy: boolean; onClose: () => void; onSave: (patch: Partial<IoTAlarmRuleDTO>) => void }) {
  const metrics = Object.keys(device.metrics)
  const [metric, setMetric] = useState(metrics[0] ?? '')
  const [op, setOp] = useState<IoTAlarmRuleDTO['op']>('>')
  const [threshold, setThreshold] = useState(0)
  const [level, setLevel] = useState<AlarmLevel>('warning')
  const [channels, setChannels] = useState<ChannelKind[]>([])
  return <Modal title="新建告警规则" onClose={onClose} width={620}>
    <div className="iot-form-grid">
      <Field label="监控指标">
        <Select value={metric} onChange={(v) => setMetric(v)} options={metrics.map((item) => ({ value: item, label: item }))} style={{ width: '100%' }} />
      </Field>
      <Field label="告警等级">
        <Select value={level} onChange={(v) => setLevel(v as AlarmLevel)} options={[{ value: 'info', label: '提示' }, { value: 'warning', label: '警告' }, { value: 'critical', label: '严重' }]} style={{ width: '100%' }} />
      </Field>
    </div>
    <div className="iot-form-grid">
      <Field label="判断条件">
        <Select value={op} onChange={(v) => setOp(v as IoTAlarmRuleDTO['op'])} options={[{ value: '>', label: '大于' }, { value: '<', label: '小于' }, { value: '==', label: '等于' }, { value: '!=', label: '不等于' }]} style={{ width: '100%' }} />
      </Field>
      <Field label="阈值">
        <InputNumber value={threshold} onChange={(v) => setThreshold(v ?? 0)} style={{ width: '100%' }} />
      </Field>
    </div>
    <Field label="通知渠道">
      <Checkbox.Group
        options={CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABEL[channel] }))}
        value={channels}
        onChange={(v) => setChannels(v as ChannelKind[])}
      />
    </Field>
    <div className="iot-modal-actions">
      <Button onClick={onClose}>取消</Button>
      <Button type="primary" loading={busy} disabled={!metric} onClick={() => onSave({ deviceId: device.id, deviceName: device.name, metric, op, threshold, level, channels, enabled: true })}>{busy ? '保存中…' : '保存规则'}</Button>
    </div>
  </Modal>
}
