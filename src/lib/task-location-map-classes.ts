/** Shared with inputs: `border-2 border-input`. Border is on a plain wrapper, not `.leaflet-container`. */
export const MAP_OUTER_FRAME_BASE =
  "overflow-hidden rounded-xs border-2 border-input bg-background box-border"

/** Default map panel height when not filling a flex parent (e.g. non-compact picker). */
export const MAP_PREVIEW_DEFAULT_CLASS = `${MAP_OUTER_FRAME_BASE} h-[min(220px,40vh)] w-full`

/** Fills parent height (compact column); keeps a floor on small viewports. */
export const MAP_PREVIEW_FILL_CLASS = `${MAP_OUTER_FRAME_BASE} h-full min-h-[200px] w-full`

/** Full-page / map route default height. */
export const OSM_ROUTING_MAP_FRAME_CLASS = `${MAP_OUTER_FRAME_BASE} z-0 h-[min(420px,55vh)] w-full`

/** Inner `MapContainer` only — border lives on the outer frame. */
export const MAP_CONTAINER_INNER_CLASS = "z-0 h-full w-full min-h-0"
