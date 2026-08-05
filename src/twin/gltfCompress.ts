import { NodeIO } from '@gltf-transform/core'
import { dedup, quantize, simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

/** 用 glTF-Transform 压缩 GLB：焊接顶点 → 去重 → 网格简化 → 量化精度 */
export async function compressGlb(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  await MeshoptSimplifier.ready
  const io = new NodeIO()
  const doc = await io.readBinary(new Uint8Array(buffer))
  await doc.transform(
    weld(),
    dedup(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.75, error: 1e-3 }),
    quantize({ pattern: /POSITION|NORMAL|TEXCOORD_0|COLOR_0/ })
  )
  const out = await io.writeBinary(doc)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
}
