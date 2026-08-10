import { nanoid } from 'nanoid'

export function genId(prefix = 'c'): string {
  return `${prefix}_${nanoid(10)}`
}
