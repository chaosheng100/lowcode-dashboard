import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Input, Popconfirm, Progress, Select, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  CompressOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  InboxOutlined,
  SearchOutlined,
  ShareAltOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  api,
  type TwinCategory,
  type TwinModelDTO,
  type TwinModelStatus,
  type TwinModelVersion
} from '../mock'
import { Field, Modal, Tag } from './common'
import { useApi } from './useApi'
import { generateModelThumbnail } from '../twin/modelThumbnail'
import { convertToGlb, isConvertibleModel } from '../twin/modelConvert'
import { compressGlb } from '../twin/gltfCompress'

const CATEGORIES: TwinCategory[] = ['建筑', '设备', '交通', '自然', '人物', '其他']
const CATEGORY_COLORS: Record<string, string> = {
  建筑: '#4f8cff',
  设备: '#a855f7',
  交通: '#22d3ee',
  自然: '#4ade80',
  人物: '#f59e0b',
  其他: '#94a3b8'
}
const STATUS_LABELS: Record<TwinModelStatus, string> = {
  draft: '草稿',
  active: '已上架',
  inactive: '已下架'
}
const STATUS_COLORS: Record<TwinModelStatus, string> = {
  draft: '#f59e0b',
  active: '#4ade80',
  inactive: '#94a3b8'
}

function formatBytes(n?: number): string {
  if (!n) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString()
}

/** 按文件地址去重，避免“共享模型 + 导入副本”同一文件出现多条 */
function dedupeModels(list: TwinModelDTO[]): TwinModelDTO[] {
  const seen = new Set<string>()
  return list.filter((m) => {
    const key = m.assetUrl || m.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: c }))
const statusOptions: { value: TwinModelStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'active', label: '已上架' },
  { value: 'inactive', label: '已下架' }
]

export default function TwinModelLibrary() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { data: models, loading, reload } = useApi(() => api.listTwinModels({ pageSize: 200 }), [])

  const [kw, setKw] = useState('')
  const [category, setCategory] = useState<TwinCategory | undefined>(undefined)
  const [libView, setLibView] = useState<'mine' | 'market'>('mine')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadName, setUploadName] = useState('')
  const [uploadCategory, setUploadCategory] = useState<TwinCategory>('设备')
  const [uploadTags, setUploadTags] = useState<string[]>([])
  const [uploadStatus, setUploadStatus] = useState<TwinModelStatus>('active')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [compressProgress, setCompressProgress] = useState<number | null>(null)
  const [uploadDrag, setUploadDrag] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState<TwinModelDTO | null>(null)
  const [compressingId, setCompressingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState<TwinCategory>('其他')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editStatus, setEditStatus] = useState<TwinModelStatus>('active')

  const [previewing, setPreviewing] = useState<TwinModelDTO | null>(null)

  const modelList = useMemo(
    () => dedupeModels((models?.list ?? []).filter((m) => !m.builtin)),
    [models],
  )
  const marketList = useMemo(
    () => dedupeModels((models?.list ?? []).filter((m) => m.market === true)),
    [models],
  )
  const activeList = libView === 'market' ? marketList : modelList
  const filtered = useMemo(() => {
    const q = kw.trim().toLowerCase()
    return activeList.filter((m) => {
      const hitKw = !q || m.name.toLowerCase().includes(q) || (m.tags ?? []).some((t) => t.toLowerCase().includes(q))
      const hitCat = !category || m.category === category
      return hitKw && hitCat
    })
  }, [activeList, kw, category])

  const pickFiles = (list: FileList | null) => {
    if (!list) return
    const ok = Array.from(list).filter((f) => /\.(glb|gltf|bin|obj|fbx|dae|ifc|skp|pts|xyz)$/i.test(f.name))
    if (!ok.length) {
      message.warning('仅支持 .glb / .gltf / .bin / .obj / .fbx / .dae / .ifc / .skp / .pts / .xyz 模型文件')
      return
    }
    setUploadFiles((prev) => [...prev, ...ok])
    setUploadName((prev) => prev || ok[0].name.replace(/\.[^.]+$/, ''))
  }

  const submitUpload = async () => {
    if (!uploadFiles.length) {
      message.warning('请先选择模型文件')
      return
    }
    setUploading(true)
    setUploadProgress({})
    let okCount = 0
    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i]
        const key = `${file.name}-${i}`
        const name =
          uploadFiles.length === 1 && uploadName.trim()
            ? uploadName.trim()
            : file.name.replace(/\.[^.]+$/, '')
        setUploadProgress((p) => ({ ...p, [key]: 5 }))
        const created = await api.createTwinModel({
          name,
          category: uploadCategory,
          tags: uploadTags,
          status: uploadStatus,
          builtin: false,
          thumbnail: ''
        })
        if (created.code !== 0) throw new Error(created.message)
        let uploadFile = file
        if (isConvertibleModel(file.name)) {
          setUploadProgress((p) => ({ ...p, [key]: 20 }))
          const conv = await convertToGlb(file)
          uploadFile = new File([conv.blob], conv.fileName, { type: 'model/gltf-binary' })
        }
        setUploadProgress((p) => ({ ...p, [key]: 35 }))
        const uploaded = await api.uploadTwinModelFile(created.data.id, uploadFile, (percent) => {
          setUploadProgress((p) => ({ ...p, [key]: 35 + Math.round(percent * 0.55) }))
        })
        if (uploaded.code !== 0) throw new Error(uploaded.message)
        if (uploaded.data.assetUrl) {
          try {
            const thumb = await generateModelThumbnail(uploaded.data.assetUrl)
            if (thumb) await api.updateTwinModel(created.data.id, { thumbnail: thumb })
          } catch {
            // thumbnail is optional; the model file itself is already uploaded
          }
        }
        setUploadProgress((p) => ({ ...p, [key]: 100 }))
        okCount++
      }
      message.success(`上传成功 ${okCount} 个模型`)
      setUploadOpen(false)
      setUploadFiles([])
      setUploadName('')
      reload()
    } catch (e) {
      message.error(`上传失败：${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  const openEdit = (m: TwinModelDTO) => {
    setEditing(m)
    setEditName(m.name)
    setEditCategory(m.category || '其他')
    setEditTags(m.tags ?? [])
    setEditStatus(m.status || 'active')
  }

  const saveEdit = async () => {
    if (!editing) return
    const name = editName.trim()
    if (!name) {
      message.warning('模型名称不能为空')
      return
    }
    const r = await api.updateTwinModel(editing.id, {
      name,
      category: editCategory,
      tags: editTags,
      status: editStatus
    })
    if (r.code !== 0) {
      message.error(r.message)
      return
    }
    message.success(`已更新「${name}」`)
    setEditing(null)
    reload()
  }

  const setModelStatus = async (m: TwinModelDTO, status: TwinModelStatus) => {
    const r = await api.updateTwinModel(m.id, { status })
    if (r.code !== 0) {
      message.error(r.message)
      return
    }
    message.success(`已${STATUS_LABELS[status]}`)
    reload()
  }

  const restoreVersion = async (m: TwinModelDTO, v: TwinModelVersion) => {
    const r = await api.updateTwinModel(m.id, {
      version: v.version,
      assetUrl: v.assetUrl,
      format: v.format,
      fileSize: v.fileSize,
      uploadedAt: v.uploadedAt
    })
    if (r.code !== 0) {
      message.error(r.message)
      return
    }
    message.success(`已恢复到 v${v.version}`)
    reload()
  }

  const removeModel = async (m: TwinModelDTO) => {
    const r = await api.deleteTwinModel(m.id)
    if (r.code !== 0) {
      message.error(r.message)
      return
    }
    message.success(`已删除「${m.name}」`)
    reload()
  }

  const publishToMarket = async (m: TwinModelDTO) => {
    const r = await api.updateTwinModel(m.id, { market: true })
    if (r.code !== 0) {
      message.error(r.message)
      return
    }
    message.success(`「${m.name}」已加入共享模型市场`)
    reload()
  }

  const importMarketModel = async (m: TwinModelDTO) => {
    const duplicated = (models?.list ?? []).some(
      (e) => e.id === m.id || (e.assetUrl && m.assetUrl && e.assetUrl === m.assetUrl),
    )
    if (duplicated) {
      message.info(`「${m.name}」已在模型库中`)
      reload()
      return
    }
    const created = await api.createTwinModel({
      name: m.name,
      category: m.category || '其他',
      tags: m.tags ?? [],
      status: 'active',
      builtin: false,
      thumbnail: '',
      market: false
    })
    if (created.code !== 0) {
      message.error(created.message)
      return
    }
    const patched = await api.updateTwinModel(created.data.id, {
      thumbnail: m.thumbnail,
      assetUrl: m.assetUrl,
      format: m.format,
      fileSize: m.fileSize,
      version: m.version ?? 1
    })
    if (patched.code !== 0) {
      message.error(patched.message)
      return
    }
    message.success(`已从市场导入「${m.name}」`)
    reload()
  }

  const compressModel = async (m: TwinModelDTO) => {
    if (!m.assetUrl) {
      message.warning('该模型没有可压缩的文件')
      return
    }
    setCompressingId(m.id)
    setCompressProgress(10)
    try {
      const res = await fetch(m.assetUrl)
      if (!res.ok) throw new Error('下载模型文件失败')
      setCompressProgress(40)
      const buf = await res.arrayBuffer()
      const compressed = await compressGlb(buf)
      setCompressProgress(70)
      const file = new File([compressed], `${m.name}-compressed.glb`, { type: 'model/gltf-binary' })
      const uploaded = await api.uploadTwinModelFile(m.id, file, (percent) => {
        setCompressProgress(70 + Math.round(percent * 0.3))
      })
      if (uploaded.code !== 0) throw new Error(uploaded.message)
      setCompressProgress(100)
      message.success(`「${m.name}」已压缩为新版本 v${uploaded.data.version}`)
      reload()
    } catch (e) {
      message.error(`压缩失败：${(e as Error).message}`)
    } finally {
      setCompressingId(null)
      setCompressProgress(null)
    }
  }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <div className="twin-lib-nav">
            <Button type="link" size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/extension/twin')}>
              返回场景管理
            </Button>
          </div>
          <h2 className="fp-title">孪生模型库</h2>
          <p className="fp-sub">模型资产集中管理 · 上传 / 命名 / 分类 / 标签 / 预览 / 删除</p>
        </div>
        <div className="fp-actions">
          <Button size="small" type={libView === 'mine' ? 'primary' : 'default'} onClick={() => { setLibView('mine'); setKw(''); setCategory(undefined) }}>
            我的模型库
          </Button>
          <Button size="small" type={libView === 'market' ? 'primary' : 'default'} icon={<ShareAltOutlined />} onClick={() => { setLibView('market'); setKw(''); setCategory(undefined) }}>
            模型市场
          </Button>
          <Input
            style={{ width: 220 }}
            placeholder="搜索名称/标签"
            prefix={<SearchOutlined />}
            allowClear
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
          <Select
            style={{ width: 130 }}
            placeholder="全部分类"
            allowClear
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
          {libView === 'mine' && (
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
              上传模型
            </Button>
          )}
        </div>
        <span className="fp-count">共 {filtered.length} 个模型 · {libView === 'market' ? '共享资产' : '我的资产'}</span>
      </div>

      {loading ? (
        <div className="empty-tip">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-tip">{libView === 'market' ? '市场暂无共享模型' : '暂无模型，点击「上传模型」导入 GLB / GLTF'}</div>
      ) : (
        <div className="twin-lib-grid">
          {filtered.map((m) => (
            <div key={m.id} className="card twin-lib-card">
              <div className="twin-lib-thumb" onClick={() => setPreviewing(m)}>
                {m.thumbnail ? (
                  <img src={m.thumbnail} alt={m.name} />
                ) : (
                  <span className="twin-model-thumb"><AppstoreOutlined /></span>
                )}
              </div>
              <div className="twin-lib-name" title={m.name}>{m.name}</div>
              <div className="twin-lib-meta">
                <div className="twin-lib-status-row">
                  <Tag color={STATUS_COLORS[m.status || 'active']}>{STATUS_LABELS[m.status || 'active']}</Tag>
                  <Tag color={CATEGORY_COLORS[m.category] ?? '#4f8cff'}>{m.category || '其他'}</Tag>
                </div>
                {m.assetUrl ? (
                  <span className="muted2">{m.format?.toUpperCase()} · {formatBytes(m.fileSize)}</span>
                ) : (
                  <span className="muted2">未上传文件</span>
                )}
              </div>
              {(m.tags ?? []).length > 0 && (
                <div className="twin-lib-tags">
                  {m.tags!.map((t) => (
                    <Tag key={t} color="#22d3ee">{t}</Tag>
                  ))}
                </div>
              )}
              <div className="twin-lib-actions">
                {libView === 'market' ? (
                  <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => importMarketModel(m)}>导入</Button>
                ) : (
                  <>
                    <div className="twin-lib-action-row">
                      <Tooltip title={m.status !== 'active' ? '上架' : '下架'}>
                        <Button
                          size="small"
                          type="text"
                          icon={m.status !== 'active' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                          onClick={() => setModelStatus(m, m.status !== 'active' ? 'active' : 'inactive')}
                        />
                      </Tooltip>
                      <Tooltip title="压缩">
                        <Button size="small" type="text" icon={<CompressOutlined />} loading={compressingId === m.id} onClick={() => compressModel(m)} />
                      </Tooltip>
                    </div>
                    {compressingId === m.id && compressProgress !== null && (
                      <Progress percent={compressProgress} size="small" strokeColor="#22d3ee" />
                    )}
                    <div className="twin-lib-action-row">
                      <Tooltip title="预览">
                        <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => setPreviewing(m)} />
                      </Tooltip>
                      <Tooltip title="编辑">
                        <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(m)} />
                      </Tooltip>
                      {m.market ? (
                        <Tooltip title="已共享">
                          <Button size="small" type="text" disabled icon={<ShareAltOutlined />} />
                        </Tooltip>
                      ) : (
                        <Tooltip title="设为共享">
                          <Button size="small" type="text" icon={<ShareAltOutlined />} onClick={() => publishToMarket(m)} />
                        </Tooltip>
                      )}
                      <Popconfirm
                        title={`删除「${m.name}」？`}
                        okText="删除"
                        cancelText="取消"
                        onConfirm={() => removeModel(m)}
                      >
                        <Tooltip title="删除">
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && (
        <Modal title="上传模型" onClose={() => !uploading && setUploadOpen(false)} width={640}>
          <div
            className={'twin-upload-zone' + (uploadDrag ? ' drag-active' : '')}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setUploadDrag(true)}
            onDragLeave={() => setUploadDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setUploadDrag(false)
              pickFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <InboxOutlined />
            <div>点击选择或拖入 .glb / .gltf / .bin / .obj / .fbx / .dae / .ifc / .skp / .pts / .xyz 文件</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf,.bin,.obj,.fbx,.dae,.ifc,.skp,.pts,.xyz"
              multiple
              hidden
              onChange={(e) => {
                pickFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
          {uploadFiles.length > 0 && (
            <div className="twin-upload-files">
              {uploadFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} className="twin-upload-file">
                  <div className="twin-upload-file-main">
                    <span className="twin-upload-file-name" title={f.name}>{f.name}</span>
                    <Progress percent={uploadProgress[`${f.name}-${i}`] ?? 0} size="small" strokeColor="#22d3ee" />
                  </div>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    disabled={uploading}
                    onClick={() => setUploadFiles((prev) => prev.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
            </div>
          )}
          <Field label="模型名称">
            <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="单个文件时留空则使用文件名" />
          </Field>
          <Field label="分类">
            <Select style={{ width: '100%' }} value={uploadCategory} onChange={setUploadCategory} options={categoryOptions} />
          </Field>
          <Field label="标签">
            <Select mode="tags" style={{ width: '100%' }} value={uploadTags} onChange={setUploadTags} placeholder="输入后回车添加" />
          </Field>
          <Field label="状态">
            <Select style={{ width: '100%' }} value={uploadStatus} onChange={setUploadStatus} options={statusOptions} />
          </Field>
          <div className="twin-modal-actions">
            <Button onClick={() => setUploadOpen(false)} disabled={uploading}>取消</Button>
            <Button type="primary" loading={uploading} disabled={!uploadFiles.length} onClick={submitUpload}>
              开始上传
            </Button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title="编辑模型" onClose={() => setEditing(null)} width={560}>
          <Field label="模型名称">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          <Field label="分类">
            <Select style={{ width: '100%' }} value={editCategory} onChange={setEditCategory} options={categoryOptions} />
          </Field>
          <Field label="标签">
            <Select mode="tags" style={{ width: '100%' }} value={editTags} onChange={setEditTags} placeholder="输入后回车添加" />
          </Field>
          <Field label="状态">
            <Select style={{ width: '100%' }} value={editStatus} onChange={setEditStatus} options={statusOptions} />
          </Field>
          <div className="twin-modal-actions">
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button type="primary" onClick={saveEdit}>保存</Button>
          </div>
        </Modal>
      )}

      {previewing && (
        <Modal title={`模型预览 · ${previewing.name}`} onClose={() => setPreviewing(null)} width={760}>
          <div className="twin-preview-grid">
            <div className="twin-preview-media">
              {previewing.thumbnail ? (
                <img src={previewing.thumbnail} alt={previewing.name} />
              ) : (
                <span className="twin-model-thumb"><AppstoreOutlined /></span>
              )}
            </div>
            <div className="twin-preview-info">
              <Field label="名称"><span>{previewing.name}</span></Field>
              <Field label="分类">
                <Tag color={CATEGORY_COLORS[previewing.category] ?? '#4f8cff'}>{previewing.category || '其他'}</Tag>
              </Field>
              <Field label="标签">
                {(previewing.tags ?? []).length
                  ? previewing.tags!.map((t) => <Tag key={t} color="#22d3ee">{t}</Tag>)
                  : <span className="muted2">无</span>}
              </Field>
              <Field label="格式"><span>{previewing.format ? previewing.format.toUpperCase() : '-'}</span></Field>
              <Field label="大小"><span>{formatBytes(previewing.fileSize)}</span></Field>
              <Field label="上传时间"><span>{formatTime(previewing.uploadedAt)}</span></Field>
              <Field label="当前版本"><span>v{previewing.version ?? 1}</span></Field>
              {previewing.assetUrl && (
                <Field label="资源地址">
                  <span className="twin-asset-url" title={previewing.assetUrl}>{previewing.assetUrl}</span>
                </Field>
              )}
              {(previewing.versions ?? []).length > 0 && (
                <div className="twin-version-list">
                  <div className="twin-section-label">版本历史</div>
                  {[...(previewing.versions ?? [])]
                    .sort((a, b) => b.version - a.version)
                    .map((v) => (
                      <div key={v.version} className="twin-version-item">
                        <span>v{v.version}</span>
                        <span className="muted2">{v.format?.toUpperCase()} · {formatBytes(v.fileSize)}</span>
                        <Button size="small" type="text" onClick={() => restoreVersion(previewing, v)}>恢复</Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
