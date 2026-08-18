import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, CSSProperties } from 'react'
import { Children, isValidElement } from 'react'
import { Card, Empty as AntEmpty, Form, Input as AntInput, Modal as AntModal, Select as AntSelect, Statistic, Tag as AntTag } from 'antd'

/** 页面级页头：主标题 + 副标题 + 右侧操作区（统一 .fp-head/.fp-title/.fp-sub 结构） */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  lead,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  lead?: ReactNode
  className?: string
}) {
  return (
    <div className={className ? `fp-head ${className}` : 'fp-head'}>
      <div>
        {lead && <div className="fp-lead">{lead}</div>}
        <h2 className="fp-title">{title}</h2>
        {subtitle && <p className="fp-sub">{subtitle}</p>}
      </div>
      {actions && <div className="fp-head-actions">{actions}</div>}
      {children}
    </div>
  )
}

/** 指标卡（统一苹果风白色圆角统计卡，替代 Stat / report-summary / screen-summary-item / 内联 Card 的多套写法） */
export function MetricRow({ children, gap = 12, style, 'aria-label': ariaLabel }: { children: ReactNode; gap?: number; style?: CSSProperties; 'aria-label'?: string }) {
  return (
    <div className="metric-row" aria-label={ariaLabel} style={{ gap, ...style }}>
      {children}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  accent = 'var(--txt)',
  onClick,
  children,
}: {
  label: ReactNode
  value: ReactNode
  accent?: string
  onClick?: () => void
  children?: ReactNode
}) {
  return (
    <div className="metric-card" onClick={onClick}>
      <div className="metric-value" style={{ color: accent }}>{value}</div>
      <div className="metric-label">{label}</div>
      {children}
    </div>
  )
}

/** 能力卡片网格容器（复用 .feat-grid 布局） */
export function FeatureGrid({ children }: { children: ReactNode }) {
  return <div className="feat-grid">{children}</div>
}

/** 能力/资源卡片：媒体位 + 名称 + 副标题 + 描述 */
export function FeatureCard({
  media,
  name,
  category,
  desc,
  onClick,
}: {
  media?: ReactNode
  name: ReactNode
  category?: ReactNode
  desc?: ReactNode
  onClick?: () => void
}) {
  return (
    <div className="feat-card" onClick={onClick}>
      {media}
      <div className="feat-name">{name}</div>
      {category && <div className="feat-cat">{category}</div>}
      {desc && <div className="feat-desc">{desc}</div>}
    </div>
  )
}

/** 卡片分区（antd Card 骨架 + 复用 .sec 壳保留渐变竖条/hover 装饰） */
export function Section({ title, desc, right, children }: { title: string; desc?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card
      className="sec"
      title={<span className="sec-title">{title}</span>}
      extra={right}
      styles={{ header: { borderBottom: 'none', minHeight: 44 }, body: { paddingTop: 0 } }}
    >
      {desc && <div className="sec-desc" style={{ marginBottom: 10 }}>{desc}</div>}
      {children}
    </Card>
  )
}

/** 表单字段（横排 Form.Item，label 宽 110px 对齐旧 .field） */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Form.Item
      label={label}
      colon={false}
      labelCol={{ flex: '110px' }}
      style={{ marginBottom: 10 }}
      extra={hint ? <div className="field-hint">{hint}</div> : undefined}
    >
      {children}
    </Form.Item>
  )
}

/** 彩色标签（保旧语义：字色=主色、底 10% 透明、边 40% 透明） */
export function Tag({ color = '#0a84ff', children }: { color?: string; children: ReactNode }) {
  return (
    <AntTag style={{ color, borderColor: color + '66', background: color + '1a', marginInlineEnd: 4 }}>
      {children}
    </AntTag>
  )
}

/** 统计卡（保留 .stat 壳装饰，大数字在上 label 在下） */
export function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return <MetricCard label={label} value={<Statistic value={value} valueStyle={{ color: accent, fontSize: 22, fontWeight: 700 }} />} accent={accent} />
}

export function Empty({ children }: { children: ReactNode }) {
  return <AntEmpty image={AntEmpty.PRESENTED_IMAGE_SIMPLE} description={children} />
}

/** 轻量弹窗（Esc/遮罩关闭为 antd 默认行为；保存/取消按钮写在 children 里，无 footer） */
export function Modal({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <AntModal open title={title} onCancel={onClose} width={width} footer={null} destroyOnHidden>
      {children}
    </AntModal>
  )
}

/** 文本输入（antd Input 的 onChange 签名与原生一致，调用点零改动） */
export function Input(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>) {
  return <AntInput {...props} />
}

/** 兼容原生写法的事件形（仅覆盖调用点用到的字段） */
type CompatSelectEvent = { target: { value: string } }

interface CompatSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'size'> {
  onChange?: (e: CompatSelectEvent) => void
  placeholder?: string
}

/**
 * @deprecated antd Select 的原生签名适配层：保留 value + e.target.value + <option> children 写法。
 * 新代码请直接用 antd Select（options + onChange(value)）。
 */
export function Select({ value, onChange, children, placeholder, disabled, style, className, id }: CompatSelectProps) {
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return []
    const p = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode }
    const v = p.value ?? (typeof p.children === 'string' ? p.children : '')
    return [{ value: String(v), label: p.children as ReactNode, disabled: p.disabled }]
  })
  return (
    <AntSelect
      id={id}
      className={className}
      style={{ minWidth: 140, ...style }}
      value={value == null ? undefined : String(value)}
      placeholder={placeholder}
      disabled={disabled}
      options={options}
      onChange={(v) => onChange?.({ target: { value: v == null ? '' : String(v) } })}
    />
  )
}

/** 文本域 */
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <AntInput.TextArea rows={4} {...props} />
}
