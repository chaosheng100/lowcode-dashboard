import { useState } from 'react'
import { App, Modal, Alert, Button, Empty, Input, List, Spin, Tag as AntTag, Upload } from 'antd'
import { DeleteOutlined, InboxOutlined, ReloadOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { useApi } from './useApi'
import { governanceApi } from '../api/governanceResourceApi'
import { FeatureCard, FeatureGrid, PageHeader } from './common'
import { getRouteCapability } from '../data/capabilities'
import type { AssetDTO } from '../mock/types'
import type { AssetReferenceSummary } from '../api/governanceResourceApi'

const TYPE_LABEL: Record<string, string> = {
  image: '图片',
  map: '地图',
  icon: '图标',
  font: '字体',
  geojson: 'GeoJSON',
  model: '模型',
  file: '文件',
}

export default function AssetLibrary() {
  const state = useApi(() => governanceApi.listAssets({ pageSize: 50 }), [])
  const { message, modal } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const [renameTarget, setRenameTarget] = useState<AssetDTO | null>(null)
  const [renameName, setRenameName] = useState('')
  const [refTarget, setRefTarget] = useState<AssetDTO | null>(null)
  const [refInfo, setRefInfo] = useState<AssetReferenceSummary | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const cap = getRouteCapability('/resources/static')

  const uploadProps: UploadProps = {
    showUploadList: false,
    beforeUpload: async (file) => {
      const response = await governanceApi.uploadAsset(file)
      if (response.code === 0) {
        state.reload()
        message.success('上传成功')
      } else {
        message.error(`上传失败：${response.message}`)
      }
      return false
    },
  }

  const openRename = (asset: AssetDTO) => {
    setRenameTarget(asset)
    setRenameName(asset.name)
  }

  const confirmRename = async () => {
    if (!renameTarget) return
    const name = renameName.trim()
    if (!name) {
      message.warning('请输入资源名称')
      return
    }
    const res = await governanceApi.renameAsset(renameTarget.id, name)
    if (res.code === 0 && res.data) {
      state.reload()
      setRenameTarget(null)
      message.success('已重命名')
    } else {
      message.error(`重命名失败：${res.message}`)
    }
  }

  const openReferences = async (asset: AssetDTO) => {
    setRefTarget(asset)
    setRefInfo(null)
    setCheckingId(asset.id)
    const res = await governanceApi.assetReferences(asset.id)
    setCheckingId(null)
    if (res.code === 0 && res.data) {
      setRefInfo(res.data)
    } else {
      message.error(`查询引用失败：${res.message}`)
    }
  }

  const requestDelete = async (asset: AssetDTO) => {
    setCheckingId(asset.id)
    const res = await governanceApi.assetReferences(asset.id)
    setCheckingId(null)
    if (res.code !== 0 || !res.data) {
      message.error(`查询引用失败：${res.message}`)
      return
    }
    const summary = res.data
    if (summary.count > 0) {
      setRefTarget(asset)
      setRefInfo(summary)
      return
    }
    modal.confirm({
      title: `删除资源「${asset.name}」？`,
      content: '删除后该资源将从静态资源列表移除，文件与历史 URL 仍会保留。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        const del = await governanceApi.archiveAsset(asset.id)
        if (del.code === 0) {
          message.success('已删除')
          state.reload()
        } else {
          message.error(`删除失败：${del.message}`)
        }
      },
    })
  }

  const list = (state.data?.list || []).filter((asset) => !keyword || asset.name.toLowerCase().includes(keyword.toLowerCase()))

  return (
    <div className="feature-page">
      <PageHeader
        title="静态资源"
        subtitle={`图片、图标、字体、GeoJSON、模型与插件附件的统一资产中心 · ${cap?.capability || ''}`}
        actions={
          <div className="fp-head-actions">
            <Input allowClear placeholder="搜索资源" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <Button icon={<ReloadOutlined />} onClick={state.reload} aria-label="刷新资产" />
            <Upload {...uploadProps}>
              <Button type="primary" icon={<InboxOutlined />}>上传资源</Button>
            </Upload>
          </div>
        }
      />
      {state.loading && <div className="fp-loading"><Spin size="small" />正在加载资源</div>}
      {state.error && <Alert type="error" showIcon message={state.error} />}
      {!state.loading && !state.error && !list.length && <Empty description="暂无资源，上传第一份素材" />}
      {!state.loading && !state.error && (
        <FeatureGrid>
          {list.map((asset) => (
            <FeatureCard
              key={asset.id}
              media={
                <div className="feat-thumb" style={{ backgroundImage: asset.url ? `url(${asset.url})` : undefined }}>
                  <AntTag>{TYPE_LABEL[asset.type] || asset.type}</AntTag>
                </div>
              }
              name={asset.name}
              category={`${TYPE_LABEL[asset.type] || asset.type} · ${asset.sizeKb}KB`}
              desc={`更新：${asset.updatedAt}`}
              onClick={() => void openReferences(asset)}
              extra={
                <div className="feat-acts">
                  <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); openRename(asset) }}>
                    重命名
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    loading={checkingId === asset.id}
                    onClick={(e) => { e.stopPropagation(); void requestDelete(asset) }}
                  >
                    删除
                  </Button>
                </div>
              }
            />
          ))}
        </FeatureGrid>
      )}
      <Modal
        title="重命名资源"
        open={!!renameTarget}
        onCancel={() => setRenameTarget(null)}
        onOk={confirmRename}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        confirmLoading={false}
      >
        <Input
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
          onPressEnter={confirmRename}
          placeholder="请输入资源名称"
          autoFocus
        />
      </Modal>
      <Modal
        title="资源引用"
        open={!!refTarget}
        onCancel={() => setRefTarget(null)}
        footer={null}
        destroyOnHidden
      >
        {checkingId === refTarget?.id ? (
          <div className="fp-loading"><Spin size="small" />正在查询引用</div>
        ) : refInfo ? (
          refInfo.count > 0 ? (
            <>
              <p className="asset-ref-summary">该资源被 {refInfo.count} 个大屏引用，暂不能删除。</p>
              <List
                size="small"
                dataSource={refInfo.screens}
                renderItem={(item) => (
                  <List.Item>
                    <span>{item.name}</span>
                    <AntTag color={item.source === 'draft' ? 'blue' : 'default'}>
                      {item.source === 'draft' ? '草稿' : `版本 ${item.version}`}
                    </AntTag>
                  </List.Item>
                )}
              />
            </>
          ) : (
            <p className="asset-ref-summary">该资源当前没有被大屏引用。</p>
          )
        ) : null}
      </Modal>
    </div>
  )
}
