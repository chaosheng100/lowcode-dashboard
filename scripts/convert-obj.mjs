import obj2gltf from 'obj2gltf'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: node scripts/convert-obj.mjs <input.obj> <output.glb>')
  process.exit(1)
}

const absInput = path.resolve(input)
const absOutput = path.resolve(output)
const glb = await obj2gltf(absInput, { binary: true })
await mkdir(path.dirname(absOutput), { recursive: true })
await writeFile(absOutput, glb)
console.log(`converted ${absInput} -> ${absOutput} (${glb.length} bytes)`)
