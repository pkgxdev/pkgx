import { useCellar, useConfig, useDownload, usePantry } from "hooks"
import useRun, { RunOptions } from "./useRun.ts"
import useLogger from "./useLogger.ts"
import * as semver from "semver"
import Path from "path"
import { host } from "../utils/index.ts";

export default async function() {
  const logger = useLogger()
  const pantry_dir = usePantry().prefix.parent()

  logger.replace("syncing pantries…")

  const { rid } = await Deno.open(pantry_dir.mkpath().string)
  await Deno.flock(rid, true)

  try {
    //TODO if there was already a lock, just wait on it, don’t do the following stuff

    const git_dir = pantry_dir.parent().join("pantries/teaxyz/pantry")

    if (git_dir.join("HEAD").isFile()) {
      await git("-C", git_dir, "fetch", "origin", "--force", "main:main")
    } else {
      await git("clone", "--bare", "--depth=1", "https://github.com/teaxyz/pantry", git_dir)
    }

    await git("--git-dir", git_dir, "--work-tree", pantry_dir, "checkout", "--force")

  } catch {
    // git failure or no git installed
    // ∴ download the latest tarball and uncompress over the top
    //FIXME deleted packages will not be removed with this method
    //TODO parallelize
    const src = new URL(`https://github.com/teaxyz/pantry/archive/refs/heads/main.tar.gz`)
    const tgz = await useDownload().download({ src })
    await run({cmd: ["tar", "xzf", tgz, "--strip-components=1"], cwd: pantry_dir })
  } finally {
    //TODO if this gets stuck then nothing will work so need a handler for that
    await Deno.funlock(rid)
    Deno.close(rid)  // docs aren't clear if we need to do this or not
  }

  logger.replace("pantries sync’d ⎷")
}

//////////////////////// utils

/// we support a tea installed or system installed git, nothing else
/// eg. `git` could be a symlink in `PATH` to tea, which would cause a fork bomb
/// on darwin if xcode or xcode/clt is not installed this will fail to our http fallback above
async function git(...args: (string | Path)[]) {
  const pkg = await useCellar().has({ project: 'git-scm.org', constraint: new semver.Range('*') })
  const git = (pkg?.path ?? usr())?.join("bin/git")
  if (git) await run({cmd: [git, ...args]})
  throw new Error("no-git")  // caught above to trigger http download instead

  function usr() {
    // only return /usr/bin if in the PATH so user can explicitly override this
    const rv = Deno.env.get("PATH")?.split(":")?.includes("/usr/bin") ? new Path("/usr") : undefined

    /// don’t cause macOS to abort and then prompt the user to install the XcodeCLT
    //FIXME test! but this is hard to test without docker images or something!
    if (host().platform == 'darwin') {
      if (new Path("/Library/Developer/CommandLineTools/usr/bin/git").isExecutableFile()) return rv
      if (new Path("/Application/Xcode.app").isDirectory()) return rv
      return
    }

    return  rv
  }
}

function run(opts: RunOptions) {
  const spin = useConfig().verbosity < 1
  return useRun({ ...opts, spin })
}
