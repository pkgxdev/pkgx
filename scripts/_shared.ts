import useCache from "hooks/useCache.ts";
import useCellar from "hooks/useCellar.ts";
import { Package, PackageRequirement, Path } from "types";
import { run } from "utils";
import { join } from "deno/path/mod.ts";
import usePantry from "hooks/usePantry.ts";
import useSourceUnarchiver from "hooks/useSourceUnarchiver.ts";

export async function bottle(req: PackageRequirement) {
  const cellar = useCellar()
  const { path: kegdir, pkg } = await cellar.resolve(req)
  const tarball = useCache().bottle(pkg)

  if (tarball.exists()) {
    console.verbose({ alreadyExists: tarball.string })
    return
  }

  const filesListName = "files.txt"

  const files = await walk(kegdir, path => {
    /// HACK: `go` requires including the `src` dir
    const isGo = kegdir.string.match(/\/go.dev\//)
    switch (path.relative({ to: kegdir })) {
    case 'src':
      return isGo ? 'accumulate' : 'skip'
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

export async function* lsPantry(path = ""): AsyncGenerator<string, void, void> {
  for await (const p of Deno.readDir(`/opt/tea.xyz/var/pantry/projects/${path}`)) {
    if (p.name === "package.yml") {
      yield path
    } else if (p.isDirectory) {
      for await (const p1 of lsPantry(join(path, p.name))) {
        if (p1) { yield p1 }
      }
    }
  }
}

export async function prepare(pkg: Package) {
  const pantry = usePantry()
  const dstdir = useCellar().mkpath(pkg).join("src")
  const { url, stripComponents } = await pantry.getDistributable(pkg)
  const { download } = useCache()
  const zip = await download({ pkg, url, type: 'src' })
  await useSourceUnarchiver().unarchive({
    dstdir,
    zipfile: zip,
    stripComponents
  })
}
