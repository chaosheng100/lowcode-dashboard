import { Alert, Table, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import type { WorkflowDTO } from '../mock'
import { Tag , PageHeader } from './common'

/** 流程列：节点用 Tag 平铺，状态保留 .status-dot 装饰点 */
const columns: TableProps<WorkflowDTO>['columns'] = [
  { title: '流程名称', dataIndex: 'name' },
  { title: '触发器', dataIndex: 'trigger', render: (v: string) => <Typography.Text type="secondary">{v}</Typography.Text> },
  {
    title: '节点',
    dataIndex: 'nodes',
    render: (nodes: string[]) => <div className="flex">{nodes.map((n) => <Tag key={n}>{n}</Tag>)}</div>
  },
  {
    title: '状态',
    dataIndex: 'status',
    render: (s: WorkflowDTO['status']) => (
      <span className={'status-dot ' + (s === 'running' ? 'active' : 'disabled')}>{s === 'running' ? '运行中' : '草稿'}</span>
    )
  }
]

/** 数据工作流：Flow 流程数据加工（解析 → 清洗 → 入库 → 大屏推送） */
export default function WorkflowPage() {
  const { data, loading, error } = useApi(() => api.listWorkflows({ pageSize: 50 }), [])
  return (
    <div className="feature-page">
      <PageHeader title="数据工作流" subtitle="Flow 流程编排：触发 → 加工节点 → 大屏数据集">
<span className="fp-count">共 {data?.list.length ?? 0} 条流程</span>
</PageHeader>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 14 }} />}
      {!error && (
        <Table<WorkflowDTO>
          columns={columns}
          dataSource={data?.list ?? []}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={false}
        />
      )}
    </div>
  )
}
