import { clearSessionResponse } from "@/lib/api/auth-utils"

export async function POST() {
  return clearSessionResponse()
}
