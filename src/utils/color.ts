import { dim, rgb8, bgRgb8, red } from "deno/fmt/colors.ts"

export const blurple = (x: string) => rgb8(x, 63)
export { dim, red }
export const inverse_blurple = (x: string) => bgRgb8(x, 63)
