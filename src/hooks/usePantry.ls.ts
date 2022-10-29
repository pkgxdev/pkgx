import Path from "path"
import { prefix } from "./usePantry.ts"

interface Entry {
  project: string
  path: Path
}

export async function* ls(): AsyncGenerator<Entry> {
  for await (const path of _ls_pantry(prefix)) {
    yield {
      project: path.parent().relative({ to: prefix }),
      path
    }
  }
}

async function* _ls_pantry(dir: Path): AsyncGenerator<Path> {
  if (!dir.isDirectory()) throw new Error()

  for await (const [path, { name, isDirectory }] of dir.ls()) {
    if (isDirectory) {
      for await (const x of _ls_pantry(path)) {
        yield x
      }
    } else if (name === "package.yml") {
      yield path
    }
  }
}
