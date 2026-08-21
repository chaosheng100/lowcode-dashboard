// ============================================================
// AI 生成历史版本管理（按画布隔离的单例 store）
// —— 每次 AI 生成（含首次生成/迭代修改/单组件调整）都保存为一个版本节点，
//    版本按 routeId（大屏画布）分桶隔离：不同画布互不干扰，各享配额。
//    支持切换预览、从历史版本继续、回退应用、版本命名、本地持久化。
// ============================================================
import { create } from 'zustand'
import type { AIDesignSchema, AIDesignIntent, AIDesignReview, AIDesignData } from '../../data/types'

/** 单个生成版本节点 */
export interface GenVersion {
  id: string
  /** 所属大屏画布 id（按画布隔离版本历史） */
  routeId: string
  /** 版本序号（从 1 开始，按画布独立递增） */
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
  /** 父版本 id（同一画布内从哪个版本衍生，形成迭代链路） */
  parentId?: string
  /** 生成来源 */
  source: 'initial' | 'iterate' | 'regenerate'
}

const STORAGE_KEY = 'lowcode-dashboard:ai-gen-history:v2'
const MAX_VERSIONS = 20

/** 生成唯一 id */
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/** 从 localStorage 加载历史（v2 按 routeId 分桶） */
function loadHistory(): Record<string, GenVersion[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch {
    return {}
  }
}

/** 保存历史到 localStorage */
function saveHistory(buckets: Record<string, GenVersion[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buckets))
  } catch {
    /* 配额不足时静默失败 */
  }
}

interface AIHistoryState {
  versionsByRoute: Record<string, GenVersion[]>
  activeByRoute: Record<string, string | null>
  addVersion: (
    routeId: string,
    data: {
      prompt: string
      schema: AIDesignSchema
      intent?: AIDesignIntent
      review?: AIDesignReview
      data?: AIDesignData
      thought?: string
    },
    parentId?: string,
    source?: GenVersion['source'],
  ) => string
  renameVersion: (routeId: string, id: string, label: string) => void
  deleteVersion: (routeId: string, id: string) => void
  clearAll: (routeId?: string) => void
  setActiveId: (routeId: string, id: string | null) => void
  getLineage: (routeId: string, id: string) => GenVersion[]
}

/** 按时间倒序分配版本号（最新的 = 1），超出上限截断最旧 */
function renumber(list: GenVersion[]): GenVersion[] {
  return list.map((v, i) => ({ ...v, version: list.length - i }))
}

/** AI 生成历史版本单例 store（按画布分桶；AIPanel / 历史面板共享） */
export const useAIHistoryStore = create<AIHistoryState>((set, get) => {
  const initial = loadHistory()
  return {
    versionsByRoute: initial,
    activeByRoute: Object.fromEntries(
      Object.entries(initial).map(([routeId, list]) => [routeId, list[0]?.id ?? null]),
    ),

    addVersion: (routeId, data, parentId, source = 'initial') => {
      const v: GenVersion = {
        id: uid(),
        routeId,
        version: 0,
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
      set((s) => {
        const bucket = renumber([v, ...(s.versionsByRoute[routeId] ?? [])]).slice(0, MAX_VERSIONS)
        return {
          versionsByRoute: { ...s.versionsByRoute, [routeId]: bucket },
          activeByRoute: { ...s.activeByRoute, [routeId]: v.id },
        }
      })
      return v.id
    },

    renameVersion: (routeId, id, label) =>
      set((s) => ({
        versionsByRoute: {
          ...s.versionsByRoute,
          [routeId]: (s.versionsByRoute[routeId] ?? []).map((v) =>
            v.id === id ? { ...v, label: label.trim() || undefined } : v
          ),
        },
      })),

    deleteVersion: (routeId, id) =>
      set((s) => {
        const bucket = renumber((s.versionsByRoute[routeId] ?? []).filter((v) => v.id !== id))
        return {
          versionsByRoute: { ...s.versionsByRoute, [routeId]: bucket },
          activeByRoute: {
            ...s.activeByRoute,
            [routeId]: s.activeByRoute[routeId] === id ? (bucket[0]?.id ?? null) : s.activeByRoute[routeId],
          },
        }
      }),

    clearAll: (routeId) =>
      set((s) => {
        if (routeId) {
          const versionsByRoute = { ...s.versionsByRoute }
          delete versionsByRoute[routeId]
          const activeByRoute = { ...s.activeByRoute }
          delete activeByRoute[routeId]
          return { versionsByRoute, activeByRoute }
        }
        return { versionsByRoute: {}, activeByRoute: {} }
      }),

    setActiveId: (routeId, id) =>
      set((s) => ({ activeByRoute: { ...s.activeByRoute, [routeId]: id } })),

    getLineage: (routeId, id) => {
      const map = new Map((get().versionsByRoute[routeId] ?? []).map((v) => [v.id, v]))
      const path: GenVersion[] = []
      let cur: GenVersion | undefined = map.get(id)
      while (cur) {
        path.unshift(cur)
        cur = cur.parentId ? map.get(cur.parentId) : undefined
      }
      return path
    },
  }
})

// localStorage 持久化：store 每次变更后同步
useAIHistoryStore.subscribe((s) => saveHistory(s.versionsByRoute))

/**
 * 按画布订阅版本历史 hook。
 * @param routeId 当前大屏画布 id；返回该画布独立的版本列表与操作。
 */
export function useGenHistory(routeId?: string | null) {
  const versions = useAIHistoryStore((s) => (routeId ? s.versionsByRoute[routeId] ?? [] : []))
  const activeId = useAIHistoryStore((s) => (routeId ? s.activeByRoute[routeId] ?? null : null))
  const setActiveId = useAIHistoryStore((s) => s.setActiveId)
  const addVersion = useAIHistoryStore((s) => s.addVersion)
  const renameVersion = useAIHistoryStore((s) => s.renameVersion)
  const deleteVersion = useAIHistoryStore((s) => s.deleteVersion)
  const clearAll = useAIHistoryStore((s) => s.clearAll)
  const getLineage = useAIHistoryStore((s) => s.getLineage)

  return {
    versions,
    activeId,
    active: versions.find((v) => v.id === activeId) ?? null,
    latest: versions[0] ?? null,
    setActiveId: (id: string | null) => routeId && setActiveId(routeId, id),
    addVersion: (
      data: Parameters<AIHistoryState['addVersion']>[1],
      parentId?: string,
      source?: GenVersion['source'],
    ) => (routeId ? addVersion(routeId, data, parentId, source) : ''),
    renameVersion: (id: string, label: string) => routeId && renameVersion(routeId, id, label),
    deleteVersion: (id: string) => routeId && deleteVersion(routeId, id),
    clearAll: () => routeId && clearAll(routeId),
    getLineage: (id: string) => (routeId ? getLineage(routeId, id) : []),
  }
}
