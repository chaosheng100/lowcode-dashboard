import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useEffect } from 'react'

/** 卡片分区 */
export function Section({ title, desc, right, children }: { title: string; desc?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="sec">
      <div className="sec-head">
        <div>
          <div className="sec-title">{title}</div>
          {desc && <div className="sec-desc">{desc}</div>}
        </div>
        {right}
      </div>
      <div className="sec-body">{children}</div>
    </div>
  )
}

/** 表单字段 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-ctrl">{children}</span>
    </label>
  )
}

/** 彩色标签 */
export function Tag({ color = '#4f8cff', children }: { color?: string; children: ReactNode }) {
  return <span className="tag" style={{ color, borderColor: color + '66', background: color + '1a' }}>{children}</span>
}

/** 统计卡 */
export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="stat">
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="fp-empty">{children}</div>
}

/** 轻量弹窗 */
export function Modal({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/** 文本输入 */
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="inp" {...props} />
}
/** 下拉 */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="inp" {...props} />
}
/** 文本域 */
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="inp area" {...props} />
}
