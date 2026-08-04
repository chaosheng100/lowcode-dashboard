// ============================================================
// 大屏列表页（对接后端版）
//  - 展示后端 /api/screens 大屏列表
//  - 点击「编辑」→ 打开编辑器窗口（后端持久化模式）
//  - 点击「新建」→ 创建大屏
// ============================================================
import { useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  type MenuProps,
} from 'antd'
import {
  AuditOutlined,
  CodeOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { screenApi } from './screenApi'
import type {
  ApprovalPolicy,
  DeployEnvironment,
  DeployRecord,
  EmbedTokenResult,
  ScreenApproval,
  ScreenItem,
} from './screenApi'

function fmt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const STATUS_META: Record<ScreenItem['status'], { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING_REVIEW: { label: '待审核', color: 'gold' },
  APPROVED: { label: '已通过', color: 'blue' },
  PUBLISHED: { label: '已发布', color: 'green' },
  ARCHIVED: { label: '已归档', color: 'red' },
}

const APPROVAL_STATUS_META: Record<ScreenApproval['status'], { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  approved: { label: '已通过', color: 'blue' },
  rejected: { label: '已驳回', color: 'red' },
  published: { label: '已发布', color: 'green' },
}

export default function ScreenListPage() {
  const { message } = App.useApp()
  const [screens, setScreens] = useState<ScreenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [kw, setKw] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')

  // 审批策略（default 范围）
  const [policy, setPolicy] = useState<ApprovalPolicy | null>(null)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [policyRequired, setPolicyRequired] = useState(false)
  const [policyReviewers, setPolicyReviewers] = useState('')

  // 提交审核 / 审核
  const [reviewScreen, setReviewScreen] = useState<ScreenItem | null>(null)
  const [reviewMode, setReviewMode] = useState<'submit' | 'review'>('submit')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewApproved, setReviewApproved] = useState(true)
  const [reviewComment, setReviewComment] = useState('')

  // 审批记录
  const [approvalScreen, setApprovalScreen] = useState<ScreenItem | null>(null)
  const [approvals, setApprovals] = useState<ScreenApproval[]>([])

  // 嵌入令牌
  const [embedScreen, setEmbedScreen] = useState<ScreenItem | null>(null)
  const [embedForm, setEmbedForm] = useState({ expiresInSec: 3600, allowedOrigins: '', baseUrl: '' })
  const [embedResult, setEmbedResult] = useState<EmbedTokenResult | null>(null)

  // 多环境部署
  const [deployScreen, setDeployScreen] = useState<ScreenItem | null>(null)
  const [deployEnvs, setDeployEnvs] = useState<DeployEnvironment[]>([])
  const [deployEnvId, setDeployEnvId] = useState('')
  const [deployVersion, setDeployVersion] = useState<number | undefined>()
  const [deployRecords, setDeployRecords] = useState<DeployRecord[]>([])
  const [deploying, setDeploying] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await screenApi.list()
    if (res.code === 0 && res.data) setScreens(res.data)
    setLoading(false)
  }

  const loadPolicy = async () => {
    const res = await screenApi.approvalPolicies()
    if (res.code !== 0) return
    const list = res.data?.list ?? []
    const current = list.find((p) => p.id === 'default') ?? list.find((p) => p.scope === 'default') ?? null
    setPolicy(current)
  }

  useEffect(() => {
    load()
    loadPolicy()
  }, [])

  const filtered = screens.filter((s) =>
    s.name.toLowerCase().includes(kw.toLowerCase()),
  )

  // 打开「新建」弹窗（用 Modal 代替 window.prompt，避免在沙箱/预览环境被禁用）
  const openCreate = () => {
    setNewName(`新大屏 ${screens.length + 1}`)
    setCreateOpen(true)
  }

  const confirmCreate = async () => {
    const name = newName.trim()
    if (!name) {
      message.warning('请输入大屏名称')
      return
    }
    // 在「创建」点击的手势内先开一个窗口（避免被浏览器弹窗拦截器拦截），创建完成后再跳转编辑器
    const win = window.open('', '_blank', 'width=1400,height=900')
    setCreateOpen(false)
    const res = await screenApi.create('default', name)
    if (res.code === 0 && res.data) {
      setScreens((prev) => [res.data!, ...prev])
      const url = buildRemoteUrl('editor', res.data.id)
      if (win) win.location.href = url
      else window.open(url, '_blank', 'width=1400,height=900') // 兜底
    } else {
      if (win) win.close()
      message.error(`创建失败：${res.message}`)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await screenApi.remove(id)
    if (res.code === 0) {
      setScreens((prev) => prev.filter((s) => s.id !== id))
    } else {
      message.error(`删除失败：${res.message}`)
    }
  }

  const handlePublish = async (id: string) => {
    const res = await screenApi.publish(id)
    if (res.code === 0 && res.data) {
      setScreens((prev) => prev.map((s) => (s.id === id ? res.data! : s)))
      message.success('发布成功')
    } else {
      message.error(`发布失败：${res.message}`)
    }
  }

  const applyScreen = (next: ScreenItem) => {
    setScreens((prev) => prev.map((s) => (s.id === next.id ? next : s)))
  }

  const openPolicy = () => {
    setPolicyRequired(policy?.required ?? false)
    setPolicyReviewers((policy?.reviewers ?? []).join('\n'))
    setPolicyOpen(true)
  }

  const savePolicy = async () => {
    const reviewers = policyReviewers
      .split(/[\n,，]/)
      .map((v) => v.trim())
      .filter(Boolean)
    const res = await screenApi.saveApprovalPolicy({
      scope: 'default',
      required: policyRequired,
      reviewers,
    })
    if (res.code === 0 && res.data) {
      setPolicy(res.data)
      setPolicyOpen(false)
      message.success('审批策略已保存')
    } else {
      message.error(`保存失败：${res.message}`)
    }
  }

  const openSubmitReview = (s: ScreenItem) => {
    setReviewMode('submit')
    setReviewNote('')
    setReviewComment('')
    setReviewApproved(true)
    setReviewScreen(s)
  }

  const openReview = (s: ScreenItem) => {
    setReviewMode('review')
    setReviewNote('')
    setReviewComment('')
    setReviewApproved(true)
    setReviewScreen(s)
  }

  const confirmReview = async () => {
    if (!reviewScreen) return
    const res =
      reviewMode === 'submit'
        ? await screenApi.submitReview(reviewScreen.id, reviewNote || undefined)
        : await screenApi.review(reviewScreen.id, reviewApproved, reviewComment || undefined)
    if (res.code === 0 && res.data) {
      applyScreen(res.data)
      setReviewScreen(null)
      message.success(reviewMode === 'submit' ? '已提交审核' : reviewApproved ? '审核已通过' : '已驳回')
    } else {
      message.error(`${reviewMode === 'submit' ? '提交审核' : '审核'}失败：${res.message}`)
    }
  }

  const openApprovals = async (s: ScreenItem) => {
    setApprovalScreen(s)
    setApprovals([])
    const res = await screenApi.approvals(s.id)
    if (res.code === 0) setApprovals(res.data ?? [])
  }

  const openEmbed = (s: ScreenItem) => {
    setEmbedScreen(s)
    setEmbedResult(null)
    setEmbedForm({ expiresInSec: 3600, allowedOrigins: '', baseUrl: '' })
  }

  const generateEmbed = async () => {
    if (!embedScreen) return
    const allowedOrigins = embedForm.allowedOrigins
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean)
    const res = await screenApi.createEmbedToken(embedScreen.id, {
      expiresInSec: embedForm.expiresInSec,
      allowedOrigins: allowedOrigins.length ? allowedOrigins : undefined,
      baseUrl: embedForm.baseUrl || undefined,
    })
    if (res.code === 0 && res.data) {
      setEmbedResult(res.data)
    } else {
      message.error(`生成失败：${res.message}`)
    }
  }

  const openDeploy = async (s: ScreenItem) => {
    setDeployScreen(s)
    setDeployEnvId('')
    setDeployVersion(s.publishedVersion ?? undefined)
    setDeployRecords([])
    const [envRes, recRes] = await Promise.all([
      screenApi.deployEnvs(),
      screenApi.deployRecords(s.id),
    ])
    if (envRes.code === 0) {
      const list = envRes.data?.list ?? []
      setDeployEnvs(list)
      if (list.length) setDeployEnvId(list[0].id)
    }
    if (recRes.code === 0) setDeployRecords(recRes.data ?? [])
  }

  const confirmDeploy = async () => {
    if (!deployScreen) return
    if (!deployEnvId) {
      message.warning('请选择部署环境')
      return
    }
    setDeploying(true)
    const res = await screenApi.deploy(deployScreen.id, deployEnvId, deployVersion)
    setDeploying(false)
    if (res.code === 0) {
      message.success('部署成功')
      const recs = await screenApi.deployRecords(deployScreen.id)
      if (recs.code === 0) setDeployRecords(recs.data ?? [])
    } else {
      message.error(`部署失败：${res.message}`)
    }
  }

  const buildActionMenu = (s: ScreenItem): MenuProps => {
    const items: NonNullable<MenuProps['items']> = []
    if (s.status === 'DRAFT') {
      if (!policy?.required) items.push({ key: 'publish', label: '直接发布', icon: <RocketOutlined /> })
      items.push({ key: 'submit', label: '提交审核', icon: <AuditOutlined /> })
    } else if (s.status === 'PENDING_REVIEW') {
      items.push({ key: 'review', label: '审核', icon: <AuditOutlined /> })
    } else if (s.status === 'APPROVED') {
      items.push({ key: 'publish', label: '发布', icon: <RocketOutlined /> })
    } else if (s.status === 'PUBLISHED') {
      items.push({ key: 'deploy', label: '多环境部署', icon: <RocketOutlined /> })
      items.push({ key: 'embed', label: '嵌入令牌', icon: <CodeOutlined /> })
    }
    items.push({ key: 'approvals', label: '审批记录', icon: <AuditOutlined /> })
    return {
      items,
      onClick: ({ key }) => {
        if (key === 'publish') handlePublish(s.id)
        if (key === 'submit') openSubmitReview(s)
        if (key === 'review') openReview(s)
        if (key === 'deploy') openDeploy(s)
        if (key === 'embed') openEmbed(s)
        if (key === 'approvals') openApprovals(s)
      },
    }
  }

  // 后端持久化模式：必须在 hash 内携带参数（应用使用 HashRouter）
  const buildRemoteUrl = (mode: 'editor' | 'preview', id: string) =>
    `${location.origin}${location.pathname}#/?mode=${mode}&routeId=${encodeURIComponent(id)}&remote=true`

  const openEditor = (id: string) => {
    window.open(buildRemoteUrl('editor', id), '_blank', 'width=1400,height=900')
  }
  const openPreview = (id: string) => {
    window.open(buildRemoteUrl('preview', id), '_blank', 'width=1400,height=900')
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>大屏管理（后端）</h2>
        <Space>
          <Input
            placeholder="搜索大屏名称"
            prefix={<SearchOutlined style={{ opacity: 0.5 }} />}
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button icon={<AuditOutlined />} onClick={openPolicy}>审批策略</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建大屏
          </Button>
        </Space>
      </div>

      {!loading && filtered.length === 0 ? (
        <Empty description="暂无大屏，点击「新建大屏」创建" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((s) => (
            <Card key={s.id} hoverable
              style={{ borderColor: s.status === 'PUBLISHED' ? '#52c41a' : '#d9d9d9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 16 }}>{s.name}</strong>
                <Tag color={STATUS_META[s.status].color}>{STATUS_META[s.status].label}</Tag>
              </div>
              <div style={{ color: '#999', fontSize: 12, marginBottom: 12 }}>
                更新于 {fmt(s.updatedAt)}
                {s.publishedVersion && ` · v${s.publishedVersion}`}
              </div>
              <div style={{ fontSize: 12, color: '#666', minHeight: 48, marginBottom: 12 }}>
                {s.description || '暂无描述'}
              </div>
              <Space size="small">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(s.id)}>
                  编辑
                </Button>
                <Button size="small" icon={<EyeOutlined />} onClick={() => openPreview(s.id)}>
                  预览
                </Button>
                <Dropdown menu={buildActionMenu(s)}>
                  <Button size="small">
                    {s.status === 'PUBLISHED' ? '管理' : '发布'} <DownOutlined />
                  </Button>
                </Dropdown>
                <Popconfirm title="确定删除？" onConfirm={() => handleDelete(s.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="新建大屏"
        open={createOpen}
        onOk={confirmCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建并打开编辑器"
        cancelText="取消"
        destroyOnHidden
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="请输入大屏名称"
          onPressEnter={confirmCreate}
          autoFocus
          style={{ marginTop: 8 }}
        />
      </Modal>

      <Modal
        title="审批策略（default）"
        open={policyOpen}
        onOk={savePolicy}
        onCancel={() => setPolicyOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={policyRequired} onChange={setPolicyRequired} />
            <span>开启后，大屏必须先提交审核并通过才能发布</span>
          </div>
          <Input.TextArea
            placeholder="默认审核人标识，每行一个"
            value={policyReviewers}
            onChange={(e) => setPolicyReviewers(e.target.value)}
            rows={4}
          />
        </Space>
      </Modal>

      <Modal
        title={reviewMode === 'submit' ? `提交审核：${reviewScreen?.name ?? ''}` : `审核：${reviewScreen?.name ?? ''}`}
        open={!!reviewScreen}
        onOk={confirmReview}
        onCancel={() => setReviewScreen(null)}
        okText={reviewMode === 'submit' ? '提交审核' : reviewApproved ? '通过' : '驳回'}
        cancelText="取消"
      >
        {reviewMode === 'submit' ? (
          <Input.TextArea
            rows={4}
            placeholder="审核说明（可选）"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Radio.Group value={reviewApproved} onChange={(e) => setReviewApproved(e.target.value)}>
              <Radio value>通过</Radio>
              <Radio value={false}>驳回</Radio>
            </Radio.Group>
            <Input.TextArea
              rows={4}
              placeholder="审核意见（可选）"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />
          </Space>
        )}
      </Modal>

      <Modal
        title={`审批记录：${approvalScreen?.name ?? ''}`}
        open={!!approvalScreen}
        onCancel={() => setApprovalScreen(null)}
        footer={<Button onClick={() => setApprovalScreen(null)}>关闭</Button>}
        width={800}
      >
        <Table<ScreenApproval>
          rowKey="id"
          dataSource={approvals}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="暂无审批记录" /> }}
          columns={[
            { title: '版本', dataIndex: 'targetVersion', width: 80 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 90,
              render: (v: ScreenApproval['status']) => (
                <Tag color={APPROVAL_STATUS_META[v].color}>{APPROVAL_STATUS_META[v].label}</Tag>
              ),
            },
            { title: '提交人', dataIndex: 'requesterId', width: 130, ellipsis: true },
            { title: '审核人', dataIndex: 'reviewerId', width: 130, ellipsis: true },
            { title: '提交说明', dataIndex: 'note', ellipsis: true },
            { title: '审核意见', dataIndex: 'comment', ellipsis: true },
            { title: '提交时间', dataIndex: 'requestedAt', width: 170, render: (v: string) => fmt(v) },
          ]}
        />
      </Modal>

      <Modal
        title={`嵌入令牌：${embedScreen?.name ?? ''}`}
        open={!!embedScreen}
        onCancel={() => setEmbedScreen(null)}
        footer={null}
        width={680}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert type="info" showIcon message="令牌只用于嵌入访问，签名密钥由服务端保管" />
          <div style={{ display: 'flex', gap: 12 }}>
            <div>
              <div style={{ marginBottom: 4 }}>有效期（秒）</div>
              <InputNumber
                min={60}
                max={86400}
                value={embedForm.expiresInSec}
                onChange={(v) => setEmbedForm({ ...embedForm, expiresInSec: v ?? 3600 })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 4 }}>公共基础地址（可选）</div>
              <Input
                placeholder="https://bi.example.com"
                value={embedForm.baseUrl}
                onChange={(e) => setEmbedForm({ ...embedForm, baseUrl: e.target.value })}
              />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>允许嵌入的 Origin（每行一个，留空表示不限制）</div>
            <Input.TextArea
              rows={3}
              value={embedForm.allowedOrigins}
              onChange={(e) => setEmbedForm({ ...embedForm, allowedOrigins: e.target.value })}
            />
          </div>
          <Button type="primary" icon={<CodeOutlined />} onClick={generateEmbed}>
            生成令牌
          </Button>
          {embedResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ marginBottom: 4 }}>Token</div>
                <Typography.Paragraph copyable={{ text: embedResult.token }} style={{ marginBottom: 0 }}>
                  <Typography.Text code style={{ wordBreak: 'break-all' }}>{embedResult.token}</Typography.Text>
                </Typography.Paragraph>
              </div>
              <div>
                <div style={{ marginBottom: 4 }}>嵌入地址</div>
                <Typography.Paragraph copyable={{ text: embedResult.embedUrl }} style={{ marginBottom: 0 }}>
                  <Typography.Text code style={{ wordBreak: 'break-all' }}>{embedResult.embedUrl}</Typography.Text>
                </Typography.Paragraph>
              </div>
              <div>
                <div style={{ marginBottom: 4 }}>SDK</div>
                <Typography.Paragraph copyable={{ text: embedResult.sdkUrl }} style={{ marginBottom: 0 }}>
                  <Typography.Text code style={{ wordBreak: 'break-all' }}>{embedResult.sdkUrl}</Typography.Text>
                </Typography.Paragraph>
              </div>
            </div>
          )}
        </Space>
      </Modal>

      <Modal
        title={`多环境部署：${deployScreen?.name ?? ''}`}
        open={!!deployScreen}
        onOk={confirmDeploy}
        confirmLoading={deploying}
        onCancel={() => setDeployScreen(null)}
        okText="部署"
        cancelText="关闭"
        width={780}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {!deployEnvs.length && (
            <Alert type="warning" showIcon message="暂无部署环境，请先在主应用的「独立部署」页创建" />
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <Select
              style={{ flex: 1 }}
              placeholder="部署环境"
              value={deployEnvId || undefined}
              onChange={setDeployEnvId}
              options={deployEnvs.map((e) => ({ value: e.id, label: `${e.name}（${e.kind || '默认'}）` }))}
            />
            <InputNumber
              min={1}
              value={deployVersion}
              onChange={(v) => setDeployVersion(v ?? undefined)}
              placeholder="版本"
              style={{ width: 130 }}
            />
          </div>
          <Table<DeployRecord>
            rowKey="id"
            dataSource={deployRecords}
            pagination={false}
            size="small"
            locale={{ emptyText: <Empty description="暂无部署记录" /> }}
            columns={[
              { title: '环境', dataIndex: 'environmentName', width: 130 },
              { title: '版本', dataIndex: 'version', width: 70 },
              {
                title: '状态',
                dataIndex: 'status',
                width: 90,
                render: (v: string) => <Tag color={v === 'deployed' ? 'green' : 'default'}>{v}</Tag>,
              },
              { title: '产物地址', dataIndex: 'artifactUrl', ellipsis: true },
              { title: '时间', dataIndex: 'deployedAt', width: 170, render: (v: string) => fmt(v) },
            ]}
          />
        </Space>
      </Modal>
    </div>
  )
}
