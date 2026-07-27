import DesignerLeftPanel from './DesignerLeftPanel'
import Canvas from './Canvas'
import PropertyPanel from './PropertyPanel'

export default function Editor() {
  return (
    <div className="editor">
      <DesignerLeftPanel />
      <Canvas />
      <PropertyPanel />
    </div>
  )
}
