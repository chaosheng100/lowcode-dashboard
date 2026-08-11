import { NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMaterialsUnlit } from '@gltf-transform/extensions'
import { dedup, meshopt, quantize, weld } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

/** 上传 GLB 仅做无损处理（焊接重复顶点 -> 去重 -> 量化精度），不简化模型顶点 */
export async function compressGlb(buffer: ArrayBuffer, useMeshopt = true): Promise<ArrayBuffer> {
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMaterialsUnlit])
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
      'meshopt.decoder': MeshoptDecoder,
    })
  const doc = await io.readBinary(new Uint8Array(buffer))
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
  await doc.transform(
    weld(),
    dedup(),
    quantize({ pattern: /POSITION|NORMAL|TEXCOORD_0|COLOR_0/ }),
    ...(useMeshopt ? [meshopt({ encoder: MeshoptEncoder, level: 'medium' })] : [])
  )
  const out = await io.writeBinary(doc)
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer
}
