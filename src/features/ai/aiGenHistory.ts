// ============================================================
// AI 生成历史版本管理
// —— 每次 AI 生成（含首次生成/迭代修改）都保存为一个版本节点，
//    支持切换预览、从历史版本继续、版本命名、本地持久化。
// ============================================================
import { useCallback, useEffect, useState } from 'react'
import type { AIDesignSchema, AIDesignIntent, AIDesignReview, AIDesignData } from '../../data/types'

/** 单个生成版本节点 */
export interface GenVersion {
  id: string
  /** 版本序号（从 1 开始，递增） */
  version: number
  /** 用户输入的 prompt */
  prompt: string
  /** 生成的大屏 Schema */
  schema: AIDesignSchema
  /** 设计意图（Orchestrator 反推） */
  intent?: AIDesignIntent
  /** 结构校验结果 */
  review?: AIDesignReview
  /** 数据绑定结果 */
  data?: AIDesignData
  /** 模型思考过程（流式增量拼接） */
  thought?: string
  /** 版本备注/名称（用户可自定义） */
  label?: string
  /** 生成时间（ISO 字符串） */
  createdAt: string
  /** 父版本 id（从哪个版本衍生而来，形成迭代链路） */
  parentId?: string
  /** 生成来源 */
  source: 'initial' | 'iterate' | 'regenerate'
}

const STORAGE_KEY = 'lowcode-dashboard:ai-gen-history:v1'
const MAX_VERSIONS = 20

/** 生成唯一 id */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/** 从 localStorage 加载历史（按 session 分组，这里 MVP 用单一存储） */
function loadHistory(): GenVersion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 保存历史到 localStorage */
function saveHistory(list: GenVersion[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* 配额不足时静默失败 */
  }
}

/**
 * 使用 AI 生成版本历史的 hook
 * —— 负责版本的增删改查、持久化、选中态管理
 */
export function useGenHistory() {
  const [versions, setVersions] = useState<GenVersion[]>(() => loadHistory())
  const [activeId, setActiveId] = useState<string | null>(null)

  // 持久化
  useEffect(() => {
    saveHistory(versions)
  }, [versions])

  /** 当前选中的版本 */
  const active = versions.find((v) => v.id === activeId) ?? null

  /** 最新版本（通常就是当前正在编辑的版本） */
  const latest = versions[0] ?? null

  /**
   * 新增一个版本（新生成完成后调用）
   * @param data 版本数据
   * @param parentId 父版本 id（迭代修改时传）
   * @param source 生成来源
   * @returns 新版本 id
   */
  const addVersion = useCallback(
    (
      data: {
        prompt: string
        schema: AIDesignSchema
        intent?: AIDesignIntent
        review?: AIDesignReview
        data?: AIDesignData
        thought?: string
      },
      parentId?: string,
      source: GenVersion['source'] = 'initial',
    ) => {
      const v: GenVersion = {
        id: uid(),
        version: 0, // 下面统一赋值
        prompt: data.prompt,
        schema: data.schema,
        intent: data.intent,
        review: data.review,
        data: data.data,
        thought: data.thought,
        createdAt: new Date().toISOString(),
        parentId,
        source,
      }
      setVersions((prev) => {
        const next = [v, ...prev]
        // 按时间倒序后分配版本号（最新的 = 1）
        next.forEach((item, i) => {
          item.version = next.length - i
        })
        // 超过上限时删除最旧的
        if (next.length > MAX_VERSIONS) {
          return next.slice(0, MAX_VERSIONS)
        }
        return next
      })
      setActiveId(v.id)
      return v.id
    },
    [],
  )

  /** 更新版本的 label（重命名） */
  const renameVersion = useCallback((id: string, label: string) => {
    setVersions((prev) =>
      prev.map((v) => (v.id === id ? { ...v, label: label.trim() || undefined } : v)),
    )
  }, [])

  /** 删除某个版本 */
  const deleteVersion = useCallback((id: string) => {
    setVersions((prev) => {
      const next = prev.filter((v) => v.id !== id)
      // 重新分配版本号
      next.forEach((item, i) => {
        item.version = next.length - i
      })
      return next
    })
    setActiveId((cur) => (cur === id ? null : cur))
  }, [])

  /** 清空全部历史 */
  const clearAll = useCallback(() => {
    setVersions([])
    setActiveId(null)
  }, [])

  /**
   * 获取某个版本的祖先链路（从该版本往上追溯到根）
   * 用于在 UI 上展示迭代路径
   */
  const getLineage = useCallback(
    (id: string): GenVersion[] => {
      const map = new Map(versions.map((v) => [v.id, v]))
      const path: GenVersion[] = []
      let cur: GenVersion | undefined = map.get(id)
      while (cur) {
        path.unshift(cur)
        cur = cur.parentId ? map.get(cur.parentId) : undefined
      }
      return path
    },
    [versions],
  )

  return {
    versions,
    active,
    activeId,
    latest,
    setActiveId,
    addVersion,
    renameVersion,
    deleteVersion,
    clearAll,
    getLineage,
  }
}
