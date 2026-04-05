export type WeatherSnapshot = {
  description: string
  tempC: number
  /** Apparent temperature (°C) from OpenWeather “feels_like”. */
  feelsLikeC: number
  code: number
}

export async function fetchWeatherForCoords(
  lat: number,
  lng: number
): Promise<WeatherSnapshot | null> {
  const key = process.env.OPENWEATHER_API_KEY
  if (!key) return null
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    appid: key,
    units: "metric",
  })
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    weather?: Array<{ description?: string; id?: number }>
    main?: { temp?: number; feels_like?: number }
  }
  const w = data.weather?.[0]
  const temp = data.main?.temp ?? 0
  const feels = data.main?.feels_like ?? temp
  return {
    description: w?.description ?? "unknown",
    tempC: temp,
    feelsLikeC: feels,
    code: w?.id ?? 0,
  }
}

/** Rough heuristic: storms / heavy precipitation discourage outdoor errands */
export function weatherBlocksOutdoorTasks(weather: WeatherSnapshot | null): boolean {
  if (!weather) return false
  const id = weather.code
  return (
    (id >= 200 && id < 300) ||
    (id >= 502 && id <= 531) ||
    (id >= 611 && id <= 616)
  )
}
