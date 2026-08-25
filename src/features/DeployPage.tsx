import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'antd'
import { ReloadOutlined, SendOutlined } from '@ant-design/icons'
import { useApi } from './useApi'
import { api } from '../mock'
import { MetricCard, MetricRow } from './common'
import { screenApi } from '../api/screenApi'
import { screenToRoute } from '../api/screenAdapter'
import { buildStandaloneHtml, type StandalonePayload } from './standaloneBuilder'
import type { DatasetDTO, DeployEnvDTO, DeployPackageDTO, DeployRecordDTO, DataSourceDTO, GlobalVarDTO } from '../mock/types'
import type { GitSyncConfig, GitSyncRecord } from '../api/screenApi'

function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const ENV_COLOR: Record<string, string> = { dev: '#0a84ff', test: '#ff9500', prod: '#34c759' }
const STATUS_COLOR: Record<string, string> = { draft: 'default', built: 'blue', deployed: 'green' }
const REC_COLOR: Record<string, string> = { building: 'gold', success: 'green', failed: 'red' }
const REC_LABEL: Record<string, string> = { building: '构建中', success: '成功', failed: '失败' }

export default function DeployPage() {
  const { message } = App.useApp()

  const { data: screenData } = useApi(() => screenApi.list(), [])
  const dashboards = useMemo(() => (screenData ?? []).map(screenToRoute), [screenData])

  const { data: envData, reload: reloadEnv } = useApi(() => api.listDeployEnvs(), [])
  const { data: pkgData, reload: reloadPkg } = useApi(() => api.listDeployPackages(), [])
  const { data: recData, reload: reloadRec } = useApi(() => api.listDeployRecords(), [])
  const { data: dsData } = useApi(() => api.listDataSources({ pageSize: 100 }), [])
  const { data: gvData } = useApi(() => api.listVars(), [])
  const { data: datasetData } = useApi(() => api.listDatasets({ pageSize: 100 }), [])

  const envs: DeployEnvDTO[] = envData?.list ?? []
  const pkgs: DeployPackageDTO[] = pkgData?.list ?? []
  const recs: DeployRecordDTO[] = recData?.list ?? []
  const dataSources: DataSourceDTO[] = dsData?.list ?? []
  const globalVars: GlobalVarDTO[] = gvData?.list ?? []
  const datasets: DatasetDTO[] = datasetData?.list ?? []

  const envName = (id: string) => envs.find((e) => e.id === id)?.name ?? id

  // ---------- 构建独立产物 payload（聚合大屏 + 数据源 + 全局变量）----------
  const buildPayload = (
    screenIds: string[],
    envId: string,
    includeGlobalVars: boolean,
    bindings: Record<string, string>,
    title: string
  ): StandalonePayload => {
    const screens = dashboards.filter((s) => screenIds.includes(s.id))
    const gvMap: Record<string, string> = {}
    if (includeGlobalVars) for (const v of globalVars) if (v.kind === 'variable') gvMap[v.name] = v.value
    const dsMap: Record<string, { kind: string; endpoint: string }> = {}
    for (const ds of dataSources) dsMap[ds.id] = { kind: ds.kind, endpoint: bindings[ds.id] || ds.endpoint }
    const datasetLabels: Record<string, string> = {}
    for (const ds of datasets) for (const f of ds.fields ?? []) if (f.label) datasetLabels[f.fieldKey] = f.label
    const env = envs.find((e) => e.id === envId)
    return {
      title,
      screens,
      globalVars: gvMap,
      dataSources: dsMap,
      datasetLabels,
      env: { name: env?.name || '默认环境', baseUrl: env?.baseUrl || '' }
    }
  }

  const exportStandalone = (screenIds: string[], envId: string, includeGlobalVars: boolean, bindings: Record<string, string>, title: string) => {
    const html = buildStandaloneHtml(buildPayload(screenIds, envId, includeGlobalVars, bindings, title))
    download(`standalone-${title || 'dashboard'}.html`, html, 'text/html')
    message.success('已导出可独立运行的 HTML 大屏')
  }

  // ---------- 环境管理 ----------
  const [envModal, setEnvModal] = useState<{ open: boolean; edit?: DeployEnvDTO }>({ open: false })
  const [envForm, setEnvForm] = useState<Partial<DeployEnvDTO>>({})
  const openEnvModal = (edit?: DeployEnvDTO) => {
    setEnvForm(edit ? { ...edit } : { name: '', kind: 'dev', baseUrl: '', description: '' })
    setEnvModal({ open: true, edit })
  }
  const saveEnv = async () => {
    if (!envForm.name || !envForm.baseUrl) { message.warning('请填写名称与目标地址'); return }
    await api.saveDeployEnv({ ...envForm, createdAt: envForm.createdAt || new Date().toISOString().slice(0, 10) })
    setEnvModal({ open: false })
    reloadEnv()
    message.success('环境已保存')
  }

  // ---------- 部署包 ----------
  const [pkgModal, setPkgModal] = useState(false)
  const [pkgForm, setPkgForm] = useState<{
    name: string; version: string; screenIds: string[]; envId: string; includeGlobalVars: boolean; bindings: Record<string, string>
  }>({ name: '', version: '1.0.0', screenIds: [], envId: envs[0]?.id || '', includeGlobalVars: true, bindings: {} })
  const openPkgModal = () => {
    const bindings: Record<string, string> = {}
    for (const ds of dataSources) bindings[ds.id] = ds.endpoint
    setPkgForm({ name: '', version: '1.0.0', screenIds: [], envId: envs[0]?.id || '', includeGlobalVars: true, bindings })
    setPkgModal(true)
  }
  const savePkg = async () => {
    if (!pkgForm.name || !pkgForm.screenIds.length || !pkgForm.envId) { message.warning('请填写名称、选择大屏与环境'); return }
    await api.saveDeployPackage({
      name: pkgForm.name, version: pkgForm.version, screenIds: pkgForm.screenIds, envId: pkgForm.envId,
      envName: envName(pkgForm.envId), datasourceBindings: pkgForm.bindings, includeGlobalVars: pkgForm.includeGlobalVars,
      status: 'draft', createdAt: new Date().toISOString().slice(0, 10), createdBy: '当前用户'
    })
    setPkgModal(false)
    reloadPkg()
    message.success('部署包已创建')
  }

  // ---------- 部署（模拟构建 + 写记录 + 联动状态）----------
  const deploy = async (pkg: DeployPackageDTO) => {
    const env = envs.find((e) => e.id === pkg.envId)
    const created = (await api.saveDeployRecord({
      packageId: pkg.id, packageName: pkg.name, version: pkg.version, envId: pkg.envId, envName: pkg.envName,
      status: 'building', deployedAt: new Date().toISOString(), deployedBy: '当前用户',
      log: ['开始构建产物...', '聚合大屏 ' + pkg.screenIds.length + ' 个 / 数据源 ' + Object.keys(pkg.datasourceBindings).length + ' 个' + (pkg.includeGlobalVars ? ' / 全局变量' : '')]
    })).data
    message.info(`正在向「${pkg.envName}」部署 ${pkg.name} ...`)
    setTimeout(async () => {
      await api.saveDeployRecord({
        id: created.id, status: 'success',
        log: [...created.log, '产物已发布至 ' + (env?.baseUrl || '目标地址'), '部署完成 ✓']
      })
      await api.saveDeployPackage({ id: pkg.id, status: 'deployed' })
      reloadRec(); reloadPkg()
      message.success(`${pkg.name} 部署成功`)
    }, 1200)
  }

  // ---------- 导出 / 构建脚本 ----------
  const [exportPkg, setExportPkg] = useState<string>(pkgs[0]?.id || '')
  const buildCli = (pkg?: DeployPackageDTO) => {
    const p = pkg || pkgs.find((x) => x.id === exportPkg)
    if (!p) { message.warning('请先选择部署包'); return }
    const env = envs.find((e) => e.id === p.envId)
    const screens = dashboards.filter((s) => p.screenIds.includes(s.id))
    const lines = [
      '#!/bin/bash',
      `# 独立部署构建脚本 · 包：${p.name}@${p.version}`,
      `# 目标环境：${p.envName}（${env?.baseUrl || ''}）`,
      'set -e', '', 'echo "▶ 安装依赖"', 'npm ci', '',
      'echo "▶ 构建大屏产物"',
      ...screens.map((s) => `npm run build -- --screen=${s.path}`),
      '', 'echo "▶ 推送至 ' + (env?.baseUrl || '目标环境') + '"',
      '# rsync -az dist/ ' + (env?.baseUrl || 'user@host:/var/www/bi') + '/',
      '', 'echo "✅ 部署完成"'
    ]
    download(`build-${p.name}.sh`, lines.join('\n'), 'text/x-shellscript')
    message.success('已生成构建脚本')
  }

  // ---------- 日志查看 ----------
  const [logModal, setLogModal] = useState<DeployRecordDTO | null>(null)

  // ---------- Git 同步 ----------
  const [gitConfigs, setGitConfigs] = useState<GitSyncConfig[]>([])
  const [gitRecords, setGitRecords] = useState<GitSyncRecord[]>([])
  const [gitConfigModal, setGitConfigModal] = useState(false)
  const [gitConfigForm, setGitConfigForm] = useState({
    name: '',
    remoteUrl: '',
    branch: 'main',
    autoPush: true,
    token: '',
  })
  const [gitTestingId, setGitTestingId] = useState('')
  const [gitTestOutput, setGitTestOutput] = useState('')
  const [gitRunConfigId, setGitRunConfigId] = useState('')
  const [gitResourceTypes, setGitResourceTypes] = useState<string[]>(['screen', 'component', 'dataset'])
  const [gitCommitMessage, setGitCommitMessage] = useState('')
  const [gitSyncing, setGitSyncing] = useState(false)
  const [gitRunResult, setGitRunResult] = useState('')

  const loadGit = async () => {
    const [c, r] = await Promise.all([screenApi.gitSyncConfigs(), screenApi.gitSyncRecords()])
    if (c.code === 0) setGitConfigs(c.data?.list ?? [])
    if (r.code === 0) setGitRecords(r.data?.list ?? [])
  }

  useEffect(() => {
    loadGit()
  }, [])

  const saveGitConfig = async () => {
    const remoteUrl = gitConfigForm.remoteUrl.trim()
    if (!remoteUrl) {
      message.warning('请填写远程仓库地址')
      return
    }
    const body: Partial<GitSyncConfig> & { remoteUrl: string } = {
      name: gitConfigForm.name.trim() || remoteUrl,
      remoteUrl,
      branch: gitConfigForm.branch.trim() || 'main',
      autoPush: gitConfigForm.autoPush,
    }
    if (gitConfigForm.token.trim()) body.token = gitConfigForm.token.trim()
    const res = await screenApi.saveGitSyncConfig(body)
    if (res.code === 0) {
      setGitConfigModal(false)
      setGitConfigForm({ name: '', remoteUrl: '', branch: 'main', autoPush: true, token: '' })
      await loadGit()
      message.success('Git 配置已保存')
    } else {
      message.error(`保存失败：${res.message}`)
    }
  }

  const testGitConfig = async (id: string) => {
    setGitTestingId(id)
    setGitTestOutput('')
    const res = await screenApi.testGitSyncConfig(id)
    setGitTestingId('')
    if (res.code === 0) {
      setGitTestOutput(res.data?.output || '连接成功')
      if (res.data?.ok) message.success('连接成功')
      else message.error('连接失败')
    } else {
      setGitTestOutput(res.message)
      message.error(`连接失败：${res.message}`)
    }
  }

  const deleteGitConfig = async (id: string) => {
    const res = await screenApi.deleteGitSyncConfig(id)
    if (res.code === 0) {
      await loadGit()
      message.success('已删除')
    } else {
      message.error(`删除失败：${res.message}`)
    }
  }

  const runGitSync = async () => {
    if (!gitRunConfigId) {
      message.warning('请先选择 Git 配置')
      return
    }
    setGitSyncing(true)
    setGitRunResult('')
    const res = await screenApi.runGitSync({
      configId: gitRunConfigId,
      resourceTypes: gitResourceTypes.length ? gitResourceTypes : undefined,
      commitMessage: gitCommitMessage.trim() || undefined,
      autoPush: true,
    })
    setGitSyncing(false)
    if (res.code === 0 && res.data) {
      const d = res.data
      setGitRunResult(
        `提交 ${d.commitHash || '无变更'}，导出 ${d.files} 个文件${d.pushed ? '，已推送远程' : ''}`,
      )
      message.success('同步完成')
      await loadGit()
    } else {
      setGitRunResult(`同步失败：${res.message}`)
      message.error(`同步失败：${res.message}`)
    }
  }

  // ====================== 视图 ======================
  const overview = (
    <div className="grid2" style={{ padding: 16, gap: 16 }}>
      <MetricRow style={{ gridColumn: '1 / -1' }}>
        <MetricCard label="可部署大屏" value={dashboards.length} accent="#0071e3" />
        <MetricCard label="已部署包" value={pkgs.filter((p) => p.status === 'deployed').length} accent="#34c759" />
        <MetricCard label="部署环境" value={envs.length} accent="#0a84ff" />
        <MetricCard label="最近部署" value={recs[0]?.packageName || '—'} accent="var(--txt)">
          <div className="fp-sub">{recs[0] ? new Date(recs[0].deployedAt).toLocaleString('zh-CN') : '暂无记录'}</div>
        </MetricCard>
      </MetricRow>
      <Card style={{ gridColumn: '1 / -1' }}>
        <div className="fp-sub" style={{ marginBottom: 8 }}>说明</div>
        <div style={{ color: '#86868b', fontSize: 13, lineHeight: 1.8 }}>
          企业级独立部署聚合「大屏 + 数据源 + 数据集 + 全局变量」多模块数据，支持多环境（开发/测试/生产）一套大屏多套配置；
          导出的独立 HTML 为<strong style={{ color: '#1d1d1f' }}>真实可运行</strong>的大屏产物，内置全局变量解析与点击联动（与平台内大屏同源联动）。
        </div>
      </Card>
    </div>
  )

  const envTab = (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => openEnvModal()}>新增环境</Button>
      </Space>
      <Table<DeployEnvDTO>
        rowKey="id" dataSource={envs} pagination={false}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '类型', dataIndex: 'kind', render: (k: string) => <Tag color={ENV_COLOR[k]}>{k}</Tag> },
          { title: '目标地址', dataIndex: 'baseUrl', ellipsis: true },
          { title: '说明', dataIndex: 'description', ellipsis: true },
          { title: '操作', width: 160, render: (_, r) => (
            <Space>
              <Button size="small" onClick={() => openEnvModal(r)}>编辑</Button>
              <Popconfirm title="确认删除该环境？" onConfirm={async () => { await api.deleteDeployEnv(r.id); reloadEnv(); message.success('已删除') }}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
    </div>
  )

  const pkgTab = (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={openPkgModal}>新建部署包</Button>
      </Space>
      <Table<DeployPackageDTO>
        rowKey="id" dataSource={pkgs} pagination={false} locale={{ emptyText: <Empty description="暂无部署包，点击「新建部署包」" /> }}
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '版本', dataIndex: 'version', width: 90 },
          { title: '大屏数', render: (_, r) => r.screenIds.length, width: 80 },
          { title: '环境', dataIndex: 'envName', render: (v) => <Tag color={ENV_COLOR[envs.find((e) => e.name === v)?.kind || 'dev']}>{v}</Tag> },
          { title: '全局变量', dataIndex: 'includeGlobalVars', render: (b: boolean) => b ? <Tag color="green">包含</Tag> : <Tag>不含</Tag>, width: 90 },
          { title: '状态', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>, width: 90 },
          { title: '操作', width: 280, render: (_, r) => (
            <Space>
              <Button size="small" type="primary" onClick={() => deploy(r)}>部署</Button>
              <Button size="small" onClick={() => exportStandalone(r.screenIds, r.envId, r.includeGlobalVars, r.datasourceBindings, r.name)}>导出 HTML</Button>
              <Popconfirm title="确认删除该部署包？" onConfirm={async () => { await api.deleteDeployPackage(r.id); reloadPkg(); message.success('已删除') }}>
                <Button size="small" danger>删除</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
    </div>
  )

  const recTab = (
    <div style={{ padding: 16 }}>
      <Table<DeployRecordDTO>
        rowKey="id" dataSource={recs} pagination={{ pageSize: 8 }} locale={{ emptyText: <Empty description="暂无部署记录" /> }}
        columns={[
          { title: '部署包', dataIndex: 'packageName' },
          { title: '版本', dataIndex: 'version', width: 90 },
          { title: '环境', dataIndex: 'envName', width: 100 },
          { title: '状态', dataIndex: 'status', width: 90, render: (s: string) => <Tag color={REC_COLOR[s]}>{REC_LABEL[s]}</Tag> },
          { title: '操作人', dataIndex: 'deployedBy', width: 100 },
          { title: '部署时间', dataIndex: 'deployedAt', width: 170, render: (v: string) => new Date(v).toLocaleString('zh-CN') },
          { title: '操作', width: 200, render: (_, r) => (
            <Space>
              <Button size="small" onClick={() => setLogModal(r)}>日志</Button>
              <Button size="small" onClick={() => { const p = pkgs.find((x) => x.id === r.packageId); if (p) deploy(p); else message.warning('原部署包已删除') }}>重新部署</Button>
            </Space>
          ) }
        ]}
      />
    </div>
  )

  const exportTab = (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
      <div className="fp-sub">选择部署包（决定导出内容与环境绑定）</div>
      <Select value={exportPkg} onChange={setExportPkg} style={{ width: '100%' }} options={pkgs.map((p) => ({ value: p.id, label: `${p.name}@${p.version}` }))} placeholder="选择部署包" />
      <Space wrap>
        <Button onClick={() => { download('dashboard-project.json', JSON.stringify({ version: '1.0', routes: dashboards }, null, 2)); message.success('已导出项目 JSON') }}>导出项目 JSON</Button>
        <Button onClick={() => {
          const p = pkgs.find((x) => x.id === exportPkg)
          const cfg = p ? { package: p.name, env: p.envName, bindings: p.datasourceBindings } : { bindings: Object.fromEntries(dataSources.map((d) => [d.id, d.endpoint])) }
          download('datasource-config.json', JSON.stringify(cfg, null, 2)); message.success('已导出数据源配置')
        }}>导出数据源配置</Button>
        <Button type="primary" onClick={() => {
          const p = pkgs.find((x) => x.id === exportPkg)
          if (!p) { message.warning('请先选择或新建部署包'); return }
          exportStandalone(p.screenIds, p.envId, p.includeGlobalVars, p.datasourceBindings, p.name)
        }}>导出独立 HTML（真实大屏）</Button>
        <Button onClick={() => buildCli()}>生成构建脚本</Button>
      </Space>
      <div className="fp-sub" style={{ marginTop: 8, color: '#6e6e73' }}>
        提示：独立 HTML 内置原生运行态，浏览器直接打开即为真实可交互大屏，支持全局变量 ${'{G.x}'} 解析与点击联动；图表优先加载 ECharts CDN，离线自动降级为 SVG。
      </div>
    </div>
  )

  const gitTab = (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => setGitConfigModal(true)}>新增 Git 配置</Button>
        <Button icon={<ReloadOutlined />} onClick={loadGit}>刷新</Button>
      </Space>
      <Table<GitSyncConfig>
        rowKey="id"
        dataSource={gitConfigs}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="暂无 Git 同步配置" /> }}
        columns={[
          { title: '名称', dataIndex: 'name', ellipsis: true },
          { title: '远程仓库', dataIndex: 'remoteUrl', ellipsis: true },
          { title: '分支', dataIndex: 'branch', width: 100, render: (v?: string) => <Tag>{v || 'main'}</Tag> },
          {
            title: '自动推送',
            dataIndex: 'autoPush',
            width: 100,
            render: (b: boolean) => (b ? <Tag color="green">开启</Tag> : <Tag>关闭</Tag>),
          },
          {
            title: '操作',
            width: 200,
            render: (_, r) => (
              <Space>
                <Button size="small" loading={gitTestingId === r.id} onClick={() => testGitConfig(r.id)}>
                  测试连接
                </Button>
                <Popconfirm title="确认删除该 Git 配置？" onConfirm={() => deleteGitConfig(r.id)}>
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      {gitTestOutput && (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title="连接测试输出"
          description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{gitTestOutput}</pre>}
        />
      )}
      <div style={{ marginTop: 20, display: 'grid', gap: 14, gridTemplateColumns: 'minmax(320px, 460px) 1fr' }}>
        <Card title="执行同步" size="small">
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <Select
              placeholder="选择 Git 配置"
              value={gitRunConfigId || undefined}
              onChange={setGitRunConfigId}
              options={gitConfigs.map((c) => ({ value: c.id, label: c.name }))}
              style={{ width: '100%' }}
            />
            <Select
              mode="multiple"
              placeholder="同步资源类型"
              value={gitResourceTypes}
              onChange={setGitResourceTypes}
              options={[
                { value: 'screen', label: '大屏' },
                { value: 'component', label: '组件' },
                { value: 'dataset', label: '数据集' },
              ]}
              style={{ width: '100%' }}
            />
            <Input
              placeholder="提交信息（可选）"
              value={gitCommitMessage}
              onChange={(e) => setGitCommitMessage(e.target.value)}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={gitSyncing}
              disabled={!gitConfigs.length}
              onClick={runGitSync}
            >
              开始同步
            </Button>
            {gitRunResult && (
              <Alert
                type={gitRunResult.startsWith('同步失败') ? 'error' : 'success'}
                showIcon
                title={gitRunResult}
              />
            )}
          </Space>
        </Card>
        <Card title="同步记录" size="small">
          <Table<GitSyncRecord>
            rowKey="id"
            dataSource={gitRecords}
            pagination={false}
            size="small"
            locale={{ emptyText: <Empty description="暂无同步记录" /> }}
            columns={[
              {
                title: '状态',
                dataIndex: 'status',
                width: 90,
                render: (v: string) => (
                  <Tag color={v === 'success' ? 'green' : 'red'}>{v === 'success' ? '成功' : '失败'}</Tag>
                ),
              },
              {
                title: '提交',
                dataIndex: 'commitHash',
                ellipsis: true,
                render: (v?: string | null) => (v ? <Tag>{v.slice(0, 8)}</Tag> : '—'),
              },
              { title: '文件', dataIndex: 'files', width: 70 },
              {
                title: '时间',
                dataIndex: 'startedAt',
                width: 170,
                render: (v: string) => new Date(v).toLocaleString('zh-CN'),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  )

  return (
    <main className="feature-page carousel-page">
      <header className="carousel-head">
        <div>
          <h1 className="fp-title">独立部署</h1>
          <p className="fp-sub">企业级：多环境 · 部署包 · 构建发布 · 与数据大屏联动</p>
        </div>
      </header>
      <Tabs
        defaultActiveKey="overview"
        items={[
          { key: 'overview', label: '概览', children: overview },
          { key: 'env', label: `环境管理 (${envs.length})`, children: envTab },
          { key: 'pkg', label: `部署包 (${pkgs.length})`, children: pkgTab },
          { key: 'rec', label: `部署记录 (${recs.length})`, children: recTab },
          { key: 'export', label: '导出 / 构建', children: exportTab },
          { key: 'git', label: `Git 同步 (${gitConfigs.length})`, children: gitTab }
        ]}
      />

      {/* 环境编辑弹窗 */}
      <Modal title={envModal.edit ? '编辑环境' : '新增环境'} open={envModal.open} onOk={saveEnv} onCancel={() => setEnvModal({ open: false })} okText="保存" cancelText="取消">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="环境名称" value={envForm.name} onChange={(e) => setEnvForm({ ...envForm, name: e.target.value })} />
          <Select value={envForm.kind} style={{ width: '100%' }} onChange={(v) => setEnvForm({ ...envForm, kind: v })} options={[{ value: 'dev', label: '开发 dev' }, { value: 'test', label: '测试 test' }, { value: 'prod', label: '生产 prod' }]} />
          <Input placeholder="目标地址，如 https://bi.example.com" value={envForm.baseUrl} onChange={(e) => setEnvForm({ ...envForm, baseUrl: e.target.value })} />
          <Input.TextArea placeholder="说明（可选）" value={envForm.description} onChange={(e) => setEnvForm({ ...envForm, description: e.target.value })} />
        </Space>
      </Modal>

      {/* 部署包新建弹窗 */}
      <Modal title="新建部署包" open={pkgModal} onOk={savePkg} onCancel={() => setPkgModal(false)} okText="创建" cancelText="取消" width={640}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Input placeholder="部署包名称" value={pkgForm.name} onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })} />
          <Input placeholder="版本号，如 1.0.0" value={pkgForm.version} onChange={(e) => setPkgForm({ ...pkgForm, version: e.target.value })} />
          <Select mode="multiple" placeholder="选择纳入部署的大屏" style={{ width: '100%' }} value={pkgForm.screenIds} onChange={(v) => setPkgForm({ ...pkgForm, screenIds: v })} options={dashboards.map((d) => ({ value: d.id, label: d.name }))} />
          <Select placeholder="目标环境" style={{ width: '100%' }} value={pkgForm.envId || undefined} onChange={(v) => setPkgForm({ ...pkgForm, envId: v })} options={envs.map((e) => ({ value: e.id, label: `${e.name}（${e.kind}）` }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={pkgForm.includeGlobalVars} onChange={(v) => setPkgForm({ ...pkgForm, includeGlobalVars: v })} />
            <span>打包全局变量（实现模块间数据互通）</span>
          </div>
          <div className="fp-sub">数据源环境级绑定（覆盖默认 endpoint，实现多环境多套配置）</div>
          <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid rgba(0, 0, 0,.35)', borderRadius: 8, padding: 8 }}>
            {dataSources.map((ds) => (
              <div key={ds.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 160, color: '#86868b', fontSize: 12 }}>{ds.name}</span>
                <Input size="small" value={pkgForm.bindings[ds.id]} onChange={(e) => setPkgForm({ ...pkgForm, bindings: { ...pkgForm.bindings, [ds.id]: e.target.value } })} />
              </div>
            ))}
          </div>
        </Space>
      </Modal>

      {/* 日志弹窗 */}
      <Modal title="部署日志" open={!!logModal} onOk={() => setLogModal(null)} onCancel={() => setLogModal(null)} footer={<Button onClick={() => setLogModal(null)}>关闭</Button>}>
        <pre style={{ background: '#f5f5f7', padding: 12, borderRadius: 8, fontSize: 12.5, color: '#34c759', maxHeight: 320, overflow: 'auto' }}>
{(logModal?.log || []).join('\n')}</pre>
      </Modal>

      {/* Git 配置弹窗 */}
      <Modal
        title="新增 Git 配置"
        open={gitConfigModal}
        onOk={saveGitConfig}
        onCancel={() => setGitConfigModal(false)}
        okText="保存"
        cancelText="取消"
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Input
            placeholder="配置名称（可选）"
            value={gitConfigForm.name}
            onChange={(e) => setGitConfigForm({ ...gitConfigForm, name: e.target.value })}
          />
          <Input
            placeholder="远程仓库地址，如 https://gitee.com/org/repo.git"
            value={gitConfigForm.remoteUrl}
            onChange={(e) => setGitConfigForm({ ...gitConfigForm, remoteUrl: e.target.value })}
          />
          <Input
            placeholder="分支，默认 main"
            value={gitConfigForm.branch}
            onChange={(e) => setGitConfigForm({ ...gitConfigForm, branch: e.target.value })}
          />
          <Input.Password
            placeholder="访问令牌（可选，HTTPS 注入）"
            value={gitConfigForm.token}
            onChange={(e) => setGitConfigForm({ ...gitConfigForm, token: e.target.value })}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={gitConfigForm.autoPush}
              onChange={(v) => setGitConfigForm({ ...gitConfigForm, autoPush: v })}
            />
            <span>同步后自动推送远程</span>
          </div>
        </Space>
      </Modal>
    </main>
  )
}
