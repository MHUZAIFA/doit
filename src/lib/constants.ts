export const COOKIE_NAME = "doit_session"

/** sessionStorage key: pathname to restore after `/sleep` wake (set when entering sleep from the shell). */
export const SLEEP_RETURN_TO_KEY = "doit:sleepReturnTo"

export const COLLECTIONS = {
  users: "users",
  tasks: "tasks",
  schedules: "schedules",
  aiInsights: "ai_insights",
  notifications: "notifications",
} as const
