/**
 * Ask for mic permission and open the device once so the browser unlocks audio
 * before Web Speech API runs (helps Chrome/Edge actually capture voice).
 */
export async function ensureMicrophoneAccess(): Promise<boolean> {
  if (typeof window === "undefined") return false

  if (!window.isSecureContext) {
    return false
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return false
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

export function isVoiceContextSupported(): boolean {
  if (typeof window === "undefined") return false
  return window.isSecureContext
}
