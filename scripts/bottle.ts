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

import { parsePackageRequirement, Path, SemVer } from "types"
import useCellar from "hooks/useCellar.ts"
import useCache from "hooks/useCache.ts"
import { run } from "utils"
import usePlatform from "../src/hooks/usePlatform.ts";

const cellar = useCellar()

for (const req of Deno.args.map(parsePackageRequirement)) {
  const { path: kegdir, pkg } = await cellar.resolve(req)
  const platform = usePlatform()
  const filesListName = "files.txt"
  const v = pkg.version
  pkg.version = new SemVer(`${v.major}.${v.minor}.${v.patch}+${platform.semver}`)

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
  const tarball = new Path("/opt/tea.xyz/var/www").join(useCache().stem(pkg) + ".tar.gz")

  await run({
    cmd: [
      "tar", "cf", tarball, "--files-from", filelist
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