// ============================================================
// Mock 接口层 —— 统一类型定义
// 用于在前端离线模拟后端 REST 接口返回，支撑设计器各模块的数据流转演示。
// ============================================================

/** 统一响应信封（与后端约定一致）：code=0 表示成功 */
export interface ApiResp<T> {
  code: number
  message: string
  data: T
}

/** 分页查询入参 */
export interface PageQuery {
  page?: number
  pageSize?: number
  keyword?: string
  sort?: string
}

/** 分页结果（列表接口 data 即此结构） */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
