export function isString(v: unknown): v is string {
  return typeof v === 'string'
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

export function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v)
}

export function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

export function isFunction(v: unknown): v is (...args: never[]) => unknown {
  return typeof v === 'function'
}

export function isArray<T = unknown>(v: unknown): v is T[] {
  return Array.isArray(v)
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isUndefined(v: unknown): v is undefined {
  return v === undefined
}

export function asArray<T>(v: unknown): T[] {
  return isArray<T>(v) ? v : []
}

export function asObject(v: unknown): Record<string, unknown> {
  return isObject(v) ? v : {}
}
