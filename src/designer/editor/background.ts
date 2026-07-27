import type { CSSProperties } from 'react'
import type { PageConfig } from '../../data/types'

/**
 * 根据页面配置计算「背景图图层」的样式。
 * 背景图作为独立的绝对定位图层，叠在背景色之上、组件之下，
 * 支持拉伸 / 平铺 / 居中三种填充方式，以及整体透明度。
 */
export function bgImageStyle(page: PageConfig): CSSProperties {
  const src = page.backgroundImage
  if (!src) return {}
  const fit = page.backgroundImageFit ?? 'stretch'
  const opacity = page.backgroundImageOpacity ?? 1

  const base: CSSProperties = {
    backgroundImage: `url("${src}")`,
    opacity,
    pointerEvents: 'none',
  }

  if (fit === 'stretch') {
    return { ...base, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }
  }
  if (fit === 'tile') {
    return { ...base, backgroundRepeat: 'repeat', backgroundSize: 'auto' }
  }
  // center：按原图尺寸居中显示
  return { ...base, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'auto' }
}
