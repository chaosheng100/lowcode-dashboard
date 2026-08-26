import { useEffect, useState } from 'react'
import { App, Button, Tabs } from 'antd'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import { api } from '../../mock'
import type { DatasetDTO, AssetDTO, ThemeDTO } from '../../mock/types'
import type { ComponentDataBinding, DataPoint, WidgetProps } from '../../data/types'
import { asArray } from '../../data/utils/typeGuards'

// 可绑定数据集的组件类型（基础"数据/图表"能力 → 画布数据）
const DATA_WIDGETS = ['lineChart', 'barChart', 'pieChart', 'metric', 'table', 'htmlComponent']

/**
 * 资源中心：把基础数据路由沉淀的能力转化为画布编辑能力。
 * - 数据集（/data/dataset）→ 绑定到选中的图表/指标/表格组件
 * - 素材（/resources/static）→ 设为画布背景 / 插入图片组件
 * - 主题（/system/runtime）→ 应用到大屏页面配色
 */
export default function ResourcePanel() {
  const { message } = App.useApp()
  const selectedId = useDesignerStore((s) => s.selectedId)
  const route = useDesignerStore((s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0])!
  const component = route.components.find((c) => c.id === selectedId)
  const updateProps = useDesignerStore((s) => s.updateComponentProps)
  const updateComponentDataSource = useDesignerStore((s) => s.updateComponentDataSource)
  const addComponent = useDesignerStore((s) => s.addComponent)
  const setPage = useDesignerStore((s) => s.setPage)

  const [tab, setTab] = useState<'dataset' | 'asset' | 'theme'>('dataset')
  const [datasets, setDatasets] = useState<DatasetDTO[]>([])
  const [assets, setAssets] = useState<AssetDTO[]>([])
  const [themes, setThemes] = useState<ThemeDTO[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    const load = async () => {
      try {
        if (tab === 'dataset') {
          const r = await api.listDatasets({ pageSize: 50 })
          if (alive) setDatasets(r.data.list)
        } else if (tab === 'asset') {
          const r = await api.listAssets({ pageSize: 50 })
          if (alive) setAssets(r.data.list)
        } else {
          const r = await api.listThemes()
          if (alive) setThemes(r.data)
        }
      } catch (e) {
        if (alive) message.error('加载失败：' + (e as Error).message)
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [tab, message])

  const bindDataset = async (ds: DatasetDTO) => {
    const isTableLike = component?.type === 'table' || component?.type === 'htmlComponent'
    if (!component || !DATA_WIDGETS.includes(component.type)) {
      message.warning('请先在画布中选中一个图表 / 指标卡 / 表格 / AI HTML 组件')
      return
    }
    // 语义字段映射：从数据集 fields 自动选维度/指标
    const fields = ds.fields ?? []
    const dimField = fields.find((f) => f.semanticType === 'dimension')
    const metricField = fields.find((f) => f.semanticType === 'metric')
    const xField = dimField?.fieldKey ?? fields[0]?.fieldKey ?? 'name'
    const yField = metricField?.fieldKey ?? fields[1]?.fieldKey ?? 'value'
    const dimKeys = fields.filter((f) => f.semanticType === 'dimension').map((f) => f.fieldKey)
    const metricKeys = fields.filter((f) => f.semanticType === 'metric').map((f) => f.fieldKey)
    const tableKeys = [...dimKeys, ...metricKeys].slice(0, 8)

    setLoading(true)
    try {
      const r = await api.queryDataset(ds.id, { pageSize: isTableLike ? 50 : 12 })
      const rows = asArray<Record<string, unknown>>(r.data?.list)
      const keys = asArray<string>(r.data?.columns).length ? asArray<string>(r.data?.columns) : tableKeys
      const binding: ComponentDataBinding = { datasetId: ds.id, xField, yField, datasetName: ds.name }
      const nextProps: Partial<WidgetProps> = {
        title: ds.name,
        dataSourceId: ds.id,
        dataSourceName: ds.name
      }
      if (isTableLike) {
        nextProps.data = rows as Array<Record<string, unknown>>
        nextProps.columns = (keys.length ? keys : tableKeys).map((key) => ({
          key,
          title: ds.fields?.find((f) => f.fieldKey === key)?.label ?? key,
          name: ds.fields?.find((f) => f.fieldKey === key)?.label ?? key,
          dataSetFieldKey: key,
        }))
      } else {
        const data: DataPoint[] = rows.map((row) => ({
          name: String(row[xField] ?? ''),
          value: Number(row[yField]) || 0
        }))
        nextProps.data = data
      }
      updateProps(component.id, nextProps)
      updateComponentDataSource(component.id, binding)
      message.success(`已将「${ds.name}」绑定到 ${component.type} 组件`)
    } catch (e) {
      message.error('加载失败：' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const setBackground = (url: string, assetId: string) => {
    setPage({
      backgroundImage: url,
      backgroundImageAssetId: assetId,
      backgroundImageFit: 'cover',
      backgroundImageOpacity: 1,
    })
    message.success('已设为画布背景')
  }
  const insertImage = (url: string, assetId: string) => {
    const id = addComponent('image', { w: 320, h: 200, x: 80, y: 80 })
    if (id) updateProps(id, { src: url, srcAssetId: assetId })
    message.success('已向画布插入图片组件')
  }
  const applyTheme = (t: ThemeDTO) => {
    setPage({ background: t.background })
    message.success(`已应用主题「${t.name}」`)
  }

  return (
    <div className="dlp-inner">
      <div style={{ color: '#86868b', fontSize: 12, marginBottom: 10 }}>基础能力 → 画布</div>
      <Tabs
        size="small"
        activeKey={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'dataset', label: '数据集' },
          { key: 'asset', label: '素材' },
          { key: 'theme', label: '主题' },
        ]}
      />

      {loading && <div className="empty-tip">加载中…</div>}

      <div className="dlp-list">
        {tab === 'dataset' &&
          datasets.map((d) => (
            <div className="rp-item" key={d.id}>
              <div className="rp-main">
                <strong>{d.name}</strong>
                <span className="rp-sub">{d.sourceName || '未知来源'} · {(d.rowCount ?? 0).toLocaleString()} 行</span>
              </div>
              <Button size="small" type="link" onClick={() => bindDataset(d)}>
                绑定到组件
              </Button>
            </div>
          ))}

        {tab === 'asset' &&
          assets.map((a) => (
            <div className="rp-item" key={a.id}>
              <div className="rp-main">
                <strong>{a.name}</strong>
                <span className="rp-sub">{a.type} · {a.sizeKb}KB</span>
              </div>
              <div className="rp-acts">
                <Button size="small" type="link" onClick={() => setBackground(a.url, a.id)}>
                  背景
                </Button>
                <Button size="small" type="link" onClick={() => insertImage(a.url, a.id)}>
                  图片
                </Button>
              </div>
            </div>
          ))}

        {tab === 'theme' &&
          themes.map((t) => (
            <div className="rp-item" key={t.id}>
              <div className="rp-main">
                <strong>
                  <span className="rp-dot" style={{ background: t.accent }} /> {t.name}
                </strong>
                <span className="rp-sub">{t.desc}</span>
              </div>
              <Button size="small" type="link" onClick={() => applyTheme(t)}>
                应用
              </Button>
            </div>
          ))}

        {!loading && tab === 'dataset' && !datasets.length && (
          <div className="empty-tip">暂无数据集</div>
        )}
        {!loading && tab === 'asset' && !assets.length && <div className="empty-tip">暂无素材</div>}
        {!loading && tab === 'theme' && !themes.length && <div className="empty-tip">暂无主题</div>}
      </div>

      <div className="dlp-hint">
        提示：选中画布中的图表/指标卡/表格后，点「绑定到组件」即可把数据集接入画布。
      </div>
    </div>
  )
}
