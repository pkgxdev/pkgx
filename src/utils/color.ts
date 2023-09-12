import { dim, rgb8, bgRgb8 } from "deno/fmt/colors.ts"

export const teal = (x: string) => rgb8(x, 86)
export { dim }
export const inverse_teal = (x: string) => bgRgb8(x, 86)
