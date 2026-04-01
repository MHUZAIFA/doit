import crypto from "crypto"

const ALGO = "aes-256-gcm"

function getKey(): Buffer | null {
  const hex = process.env.TASK_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) return null
  return Buffer.from(hex, "hex")
}

export function encryptSensitiveText(plain: string): { cipher: string; iv: string; tag: string } | null {
  const key = getKey()
  if (!key) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    cipher: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  }
}

export function decryptSensitiveText(payload: {
  cipher: string
  iv: string
  tag: string
}): string | null {
  const key = getKey()
  if (!key) return null
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, "base64"))
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"))
    const out = Buffer.concat([
      decipher.update(Buffer.from(payload.cipher, "base64")),
      decipher.final(),
    ])
    return out.toString("utf8")
  } catch {
    return null
  }
}
