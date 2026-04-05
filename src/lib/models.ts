import type { ObjectId } from "mongodb"

export type ThemePreference = "light" | "dark" | "system"

export type UserPreferences = {
  theme: ThemePreference
  businessHoursStart: string
  businessHoursEnd: string
  privacyMode: boolean
  timezone: string
  /** Substring or full name from `speechSynthesis.getVoices()`; empty = browser default English. */
  wakeVoiceNameIncludes: string
  /** Spoken first when the post-wake briefing runs. */
  wakeGreeting: string
  /** When true, wake music after sleep is silent; voice briefing still plays. */
  wakeMusicMuted: boolean
}

export type UserGamification = {
  streak: number
  lastActiveDate: string | null
  productivityScore: number
  tasksCompleted: number
}

export type UserDocument = {
  _id: ObjectId
  email: string
  name: string
  passwordHash: string
  preferences: UserPreferences
  gamification: UserGamification
  createdAt: Date
}

export type TaskLocation = {
  name: string
  coordinates?: { lat: number; lng: number }
}

export type TaskStatus = "pending" | "scheduled" | "completed" | "cancelled"

export type TaskPriority = "low" | "medium" | "high"

export type TaskDocument = {
  _id: ObjectId
  userId: ObjectId
  title: string
  description?: string
  category: string
  location: TaskLocation
  durationMinutes: number
  deadline: Date | null
  priority: TaskPriority
  constraints?: Record<string, unknown>
  status: TaskStatus
  encryptedTitle?: string
  encryptedPayload?: { cipher: string; iv: string; tag: string }
  createdAt: Date
  updatedAt: Date
}

export type ScheduledTaskSlot = {
  taskId: string
  startTime: string
  endTime: string
  locked?: boolean
}

export type ScheduleOption = {
  optionId: string
  tasks: ScheduledTaskSlot[]
  score: number
}

export type ScheduleDocument = {
  _id: ObjectId
  userId: ObjectId
  date: string
  scheduleOptions: ScheduleOption[]
  alerts: string[]
  /** Short AI tradeoff summary; omitted when privacy mode or unavailable */
  aiSummary?: string | null
  createdAt: Date
  updatedAt: Date
}

export type AiInsightsDocument = {
  _id: ObjectId
  userId: ObjectId
  productivityPattern: string
  commonDelays: string[]
  lastUpdated: Date
}

export type NotificationDocument = {
  _id: ObjectId
  userId: ObjectId
  type: "reminder" | "schedule" | "gamification" | "system"
  title: string
  body: string
  read: boolean
  createdAt: Date
}

export function defaultPreferences(): UserPreferences {
  return {
    theme: "system",
    businessHoursStart: "09:00",
    businessHoursEnd: "17:00",
    privacyMode: false,
    timezone: "UTC",
    wakeVoiceNameIncludes: "",
    wakeGreeting: "Welcome back sir!",
    wakeMusicMuted: false,
  }
}

export function defaultGamification(): UserGamification {
  return {
    streak: 0,
    lastActiveDate: null,
    productivityScore: 0,
    tasksCompleted: 0,
  }
}
