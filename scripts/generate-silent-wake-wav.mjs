/**
 * One-off: writes public/audio/wake.wav (mono PCM, ~20s silence).
 * Replace with your own track; MP3 also supported if you set WakeMusic.src.
 */
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const out = join(__dirname, "../public/audio/wake.wav")

const sampleRate = 44100
const durationSec = 20
const numChannels = 1
const bitsPerSample = 16
const numSamples = sampleRate * durationSec
const dataSize = numSamples * numChannels * (bitsPerSample / 8)
const buffer = Buffer.alloc(44 + dataSize)

buffer.write("RIFF", 0)
buffer.writeUInt32LE(36 + dataSize, 4)
buffer.write("WAVE", 8)
buffer.write("fmt ", 12)
buffer.writeUInt32LE(16, 16)
buffer.writeUInt16LE(1, 20)
buffer.writeUInt16LE(numChannels, 22)
buffer.writeUInt32LE(sampleRate, 24)
buffer.writeUInt32LE((sampleRate * numChannels * bitsPerSample) / 8, 28)
buffer.writeUInt16LE((numChannels * bitsPerSample) / 8, 32)
buffer.writeUInt16LE(bitsPerSample, 34)
buffer.write("data", 36)
buffer.writeUInt32LE(dataSize, 40)

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, buffer)
console.log("Wrote", out, `(${buffer.length} bytes)`)
