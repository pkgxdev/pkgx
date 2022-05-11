import { Path, PackageRequirement, semver } from "types"
import { usePackageYAMLFrontMatter } from "./usePackageYAML.ts"
import { download } from "utils"
import useFlags from "hooks/useFlags.ts"

interface Return {
  deps: PackageRequirement[]
  args: string[]
}

export default async function useScript(path: Path | URL, srcroot?: Path): Promise<Return> {
  path = await (async () => {
    if (path instanceof URL) {
      const downloaded = await download(path)
      return new Path(downloaded.path)
    } else {
      return path
    }
  })()

  if (path.extname() == ".md") {
    throw new Error("unimpl")
  } else {
    const yaml = await usePackageYAMLFrontMatter(path, srcroot).swallow("no-front-matter")
    const args = yaml?.getArgs() ?? []
    const deps = yaml?.getDeps(false) ?? []
    const push = (project: string) => deps.push({ project, constraint: new semver.Range("*") })
    const muggleCheck = () => { if (!useFlags().magic) throw "cannot-do-magic-in-muggle-mode" }

    if (args.length < 1) {
      muggleCheck()

      switch (path.extname()) {
      case ".py":
        args.push("python")
        push("python.org")
        break
      case ".ts":
      case ".js":
        args.push("deno", "run")
        push("deno.land")
        break
      case ".sh":
        args.push("sh") //TODO more?
        break
      default:
        throw "not-sure-what-to-do-with-this-file-sorry"
      }
    } else if (deps.length < 1) {
      muggleCheck()

      switch (args[0]) {
      case "python":
        push("python.org")
        break
      case "deno":
        push("deno.land")
        break
      }
    }

    console.debug({ args, deps })

    return {
      args: [...args, path.string],
      deps
    }
  }
}
