import { run, Unarchiver, TarballUnarchiver, ZipUnarchiver } from "utils"
import { useFlags } from "hooks"
import { Verbosity } from "types"
import Path from "path"

//FIXME assuming strip 1 on components is going to trip people up

interface Options {
  dstdir: Path    /// must be empty
  zipfile: Path
  stripComponents?: number
}

interface Response {
  unarchive(opts: Options): Promise<Path>
}

export default function useSourceUnarchiver(): Response {
  const unarchive = async (opts: Options) => {
    const { verbosity } = useFlags()

    let unarchiver: Unarchiver
    if (TarballUnarchiver.supports(opts.zipfile)) {
      opts.dstdir.mkpath()
      unarchiver = new TarballUnarchiver({ verbosity, ...opts })
    } else if (ZipUnarchiver.supports(opts.zipfile)) {
      const stripComponents = opts.stripComponents ?? 0
      const needsTmpdir = stripComponents > 0
      const dstdir = needsTmpdir ? new Path(Deno.makeTempDirSync({ prefix: "tea" })) : opts.dstdir
      try {
        unarchiver = new ZipUnarchiver({ verbosity, ...opts, dstdir })
        if (needsTmpdir) {
          throw new Error("unimpl")
        }
      } finally {
        if (needsTmpdir) {
          if (verbosity >= Verbosity.debug) {
            dstdir.rm()
          } else {
            console.debug({ leaving: dstdir })
          }
        }
      }
    } else {
      throw "archive-not-supported"
    }

    const cmd = unarchiver.args()

    await run({ cmd })

    return opts.dstdir
  }
  return { unarchive }
}
