import { NodeIO } from '@gltf-transform/core'
import { dedup, quantize, weld } from '@gltf-transform/functions'

/** 上传 GLB 仅做无损处理（焊接重复顶点 -> 去重 -> 量化精度），不简化模型顶点 */
export async function compressGlb(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const io = new NodeIO()
  const doc = await io.readBinary(new Uint8Array(buffer))
  await doc.transform(
    weld(),
    dedup(),
    quantize({ pattern: /POSITION|NORMAL|TEXCOORD_0|COLOR_0/ })
  )
  const out = await io.writeBinary(doc)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
}
