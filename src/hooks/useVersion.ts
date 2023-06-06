//NOTE we statically replace this file at deployment

import { README } from "./useVirtualEnv.ts"
import { Path } from "tea"

const version = `${(
  await README(
    new Path(new URL(import.meta.url).pathname)
      .parent().parent().parent()
      .join("README.md")
  ).swallow(/not-found/))?.version}+dev`

export default function() {
  return version
}
