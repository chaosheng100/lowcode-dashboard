import { useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Input } from 'antd'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { ComponentMetaDTO } from '../../mock/types'
import type { WidgetType } from '../../data/types'

function DraggableItem({ def }: { def: ComponentMetaDTO }) {
  const id = `catalog-${def.type}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { type: def.type as WidgetType, meta: def },
  })
  return (
    <div
      ref={setNodeRef}
      className={`cp-item${isDragging ? ' dragging' : ''}`}
      title={`${def.name}${def.description ? ` · ${def.description}` : ''}${def.version ? ` · v${def.version}` : ''}`}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      {...listeners}
      {...attributes}
    >
      <span className="ico">{def.icon || '◆'}</span>
      <span>{def.name}</span>
      {def.version && <span className="cp-version">{def.version}</span>}
    </div>
  )
}

export default function ComponentPanel() {
  const [keyword, setKeyword] = useState('')
  const catalog = useDesignerStore((s) => s.catalog)
  const catalogLoading = useDesignerStore((s) => s.catalogLoading)
  const catalogError = useDesignerStore((s) => s.catalogError)

  const groups = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const filtered = catalog.filter((c) =>
      !kw ||
      c.type.toLowerCase().includes(kw) ||
      c.name.toLowerCase().includes(kw) ||
      c.category.toLowerCase().includes(kw)
    )
    const map = new Map<string, ComponentMetaDTO[]>()
    for (const c of filtered) {
      const list = map.get(c.category) || []
      list.push(c)
      map.set(c.category, list)
    }
    return Array.from(map.entries())
  }, [catalog, keyword])

  return (
    <div className="dlp-inner">
      <Input.Search
        className="cp-search"
        allowClear
        size="small"
        placeholder="搜索组件"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      {catalogLoading && <div className="cp-empty">加载组件目录...</div>}
      {!catalogLoading && catalogError && <div className="cp-empty">{catalogError}</div>}
      {!catalogLoading && !catalogError && groups.length === 0 && (
        <div className="cp-empty">暂无组件</div>
      )}
      {groups.map(([cat, items]) => (
        <div className="cp-group" key={cat}>
          <h4>{cat}</h4>
          {items.map((def) => (
            <DraggableItem key={def.type} def={def} />
          ))}
        </div>
      ))}
    </div>
  )
}
