#!/usr/bin/env -S tea -E

/* ---
args:
  - deno
  - run
  - --allow-net
  - --allow-write=/opt/
  - --allow-read
  - --allow-run
  - --import-map={{ srcroot }}/import-map.json
--- */

import { parsePackageRequirement, Path } from "types"
import useCellar from "hooks/useCellar.ts"
import useCache from "hooks/useCache.ts"
import { run } from "utils"

const cellar = useCellar()

for (const req of Deno.args.map(parsePackageRequirement)) {
  const { path: kegdir, pkg } = await cellar.resolve(req)
  const tarball = useCache().bottle(pkg)

  if (tarball.exists()) {
    console.verbose({ alreadyExists: tarball.string })
    continue
  }

  const filesListName = "files.txt"

  const files = await walk(kegdir, path => {
    switch (path.relative({ to: kegdir })) {
    case 'src':
    case 'build.sh':
    case filesListName:
      return 'skip'
    default:
      return 'accumulate'
    }
  })
  const relativePaths = files.map(x => x.relative({ to: cellar.prefix }))

  const filelist = kegdir.join(filesListName).write({ text: relativePaths.join("\n"), force: true })

  await run({
    cmd: [
      "tar", "zcf", tarball, "--files-from", filelist
    ],
    cwd: cellar.prefix
  })
}


// using our own because of: https://github.com/denoland/deno_std/issues/1359
// but frankly this also is more suitable for our needs here
type Continuation = 'accumulate' | 'skip'

export async function walk(root: Path, body: (entry: Path) => Continuation): Promise<Path[]> {
  const rv: Path[] = []
  const stack: Path[] = [root]

  do {
    root = stack.pop()!
    for await (const [path, entry] of root.ls()) {
      switch (body(path)) {
      case 'accumulate':
        if (entry.isDirectory) {
          stack.push(path)
        } else {
          rv.push(path)
        }
        break
      case 'skip':
        continue
      }
    }
  } while (stack.length > 0)

  return rv
}