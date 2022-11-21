import { usePrefix } from "hooks"
import Path from "path"
import TeaError from "utils/error.ts"

//TODO keeping this because some pantry scripts expect it
export const prefix = usePrefix().join('tea.xyz/var/pantry/projects')

export function pantry_paths(): Path[] {
  const rv: Path[] = [prefix]
  const env = Deno.env.get("TEA_PANTRY_PATH")
  if (env) for (const path of env.split(":").reverse()) {
    rv.unshift(Path.cwd().join(path, "projects"))
  }
  return rv
}

interface Entry {
  project: string
  path: Path
}

export async function* ls(): AsyncGenerator<Entry> {
  for (const prefix of pantry_paths()) {
    for await (const path of _ls_pantry(prefix)) {
      yield {
        project: path.parent().relative({ to: prefix }),
        path
      }
    }
  }
}

async function* _ls_pantry(dir: Path): AsyncGenerator<Path> {
  if (!dir.isDirectory()) throw new TeaError('not-found: pantry', { path: dir })

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
