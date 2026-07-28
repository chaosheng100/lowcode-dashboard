import PluginManagement from './PluginManagement'
import { api } from '../mock'
import type { TwinSceneDTO } from '../mock/types'
import { Tag } from './common'
import TwinPage from './TwinPage'

/** 数字孪生：场景列表 + 进入编辑器（3D 场景编辑器）+ 预览（关系与大屏管理一致） */
export default function TwinManagement() {
  return (
    <PluginManagement<TwinSceneDTO>
      title="数字孪生"
      subtitle="三维可视化场景搭建与预览，支持 3D 编辑器设计"
      countLabel="场景"
      fetcher={() => api.listTwinScenes({ pageSize: 50 })}
      saveItem={(b) => api.saveTwinScene(b)}
      deleteItem={(id) => api.deleteTwinScene(id)}
      blankItem={() => ({ id: '', name: '新建场景', models: [], lighting: 'day', fog: false, status: 'offline', updatedAt: '' })}
      renderMeta={(s) => [`模型数：${s.models.length}`, `光照：${s.lighting === 'day' ? '日照' : '夜景'}`, s.fog ? '雾效：开' : '雾效：关']}
      renderTags={(s) => (
        <div className="flex" style={{ margin: '6px 0' }}>
          <Tag color={s.lighting === 'day' ? '#facc15' : '#6366f1'}>{s.lighting === 'day' ? '日照' : '夜景'}</Tag>
          {s.fog && <Tag>雾效</Tag>}
        </div>
      )}
      renderEditor={() => <TwinPage />}
      renderPreview={() => <TwinPage />}
    />
  )
}
