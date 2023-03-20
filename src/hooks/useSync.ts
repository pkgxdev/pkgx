import { useDownload, useCellar, usePantry, useFlags, useRun } from "hooks"
import { RunOptions } from "hooks/useRun.ts"
import { host } from "utils"
import useLogger, { Logger } from "./useLogger.ts"
import * as semver from "semver"
import Path from "path"

async function find_git({tea_ok}: {tea_ok: boolean} = {tea_ok: false}): Promise<Path | undefined> {
  for (const path_ of Deno.env.get('PATH')?.split(':') ?? []) {
    const path = Path.root.join(path_, 'git')
    if (path.string == '/usr/bin/git' && host().platform == 'darwin' && !await clt_installed()) {
      // if the CLT or Xcode is installed then we can use the system git
      // if neither is installed then git will actually immediately exit with an error
      continue
    }
    if (!tea_ok && path.isSymlink() && path.readlink().basename() == "tea") {
      // we cannot install git via ourselves before we have fetched the pantries
      continue
    }
    if (path.isExecutableFile()) {
      return Promise.resolve(path)
    }
  }

  const pkg = {project: 'git-scm.org', constraint: new semver.Range('*')}
  const git = await useCellar().has(pkg)
  return git?.path.join('bin/git')

  //ALERT! don’t install git with tea
  // there's no pantry yet, so attempting to do so will infinitely recurse
}

async function clt_installed() {
  // returns either the CLT path or the Xcode path
  const proc = Deno.run({ cmd: ["xcode-select", "--print-path"], stdout: "null", stderr: 'null' })
  const exit = await proc.status()
  return exit.success
}

const pantry_dir = usePantry().prefix.parent()
const pantries_dir = pantry_dir.parent().join("pantries")

let avoid_softlock = false

async function lock<T>(body: () => Promise<T>) {
  if (avoid_softlock) throw new Error("aborting to prevent softlock")
  avoid_softlock = true

  const { rid } = await Deno.open(pantry_dir.mkpath().string)
  await Deno.flock(rid, true)

  try {
    return await body()
  } finally {
    //TODO if this gets stuck then nothing will work so need a handler for that
    await Deno.funlock(rid)
    Deno.close(rid)  // docs aren't clear if we need to do this or not
    avoid_softlock = false
  }
}

//TODO we have a better system in mind than git
export async function install(logger: Logger): Promise<true | 'not-git' | 'noop' | 'deprecated'> {
  if (usePantry().prefix.exists()) {
    if (pantries_dir.exists()) return 'noop'
    if (pantry_dir.join('.git').exists()) return 'deprecated'

    // FIXME in this case we have a downloaded pantry so we should install git
    return 'not-git'
  }

  logger.replace("fetching pantries…")

  try {
    const git = await find_git()
    const rv = await lock(async () => {
      if (usePantry().prefix.exists()) return 'noop'
      // ^^ another instance of tea did the install while we waited

      if (git) {
        await clone(git)
        return true
      } else {
        await unzip()
        return 'not-git'
      }
    })
    logger.replace("pantries init’d ⎷")
    return rv
  } catch (e) {
    pantries_dir.rm({ recursive: true }) // leave us in a blank state
    pantry_dir.rm({ recursive: true })   // ^^
    throw e
  }

  async function clone(git: Path) {
    await run({
      cmd: [
        git, "clone",
          "--bare", "--depth=1",
          `https://github.com/teaxyz/pantry`,
          pantries_dir.join("teaxyz").mkpath().join("pantry")
      ]
    })
    await co(git)
  }

  async function unzip() {
    //FIXME if we do this, we need to be able to convert it to a git installation later
    //TODO use our tar if necessary
    //TODO if we keep this then don’t store the files, just pipe to tar
    const src = new URL(`https://github.com/teaxyz/pantry/archive/refs/heads/main.tar.gz`)
    const tgz = await useDownload().download({ src })
    const cwd = pantry_dir.mkpath()
    await run({cmd: ["tar", "xzf", tgz, "--strip-components=1"], cwd })
  }
}

async function *ls() {
  for await (const [user, {isDirectory, name: user_name}] of pantries_dir.ls()) {
    if (!isDirectory) continue
    for await (const [repo, {isDirectory, name: repo_name}] of user.ls()) {
      if (!isDirectory) continue
      if (user_name == "teaxyz" && repo_name == "pantry.core") {
        // we used to have multiple pantries, but not anymore!
        continue
      }
      yield repo
  }}
}

export const update = async () => {
  const logger = useLogger()

  logger.replace("inspecting pantries…")

  switch (await install(logger)) {
  case 'deprecated':
    console.warn("pantry is a clone, this is deprecated, please clean-install tea")
    break
  case 'not-git':
    console.warn("pantry is not a git repository, cannot update")
    break
  case 'noop': {
    logger.replace("syncing pantries…")

    const git = await find_git({tea_ok: true})
    if (!git) return console.warn("cannot update pantry without git")

    //TODO if we were waiting on someone else then we shouldn’t bother
    // updating *again* we'll be up-to-date already
    await lock(async () => {
      const pp: Promise<void>[] = []
      for await (const cwd of ls()) {
        const p = run({cmd: [git, "fetch", "origin", "--force", "main:main"], cwd })
        pp.push(p)
      }
      await Promise.all(pp)

      logger.replace("overlaying pantries…")
      await co(git)
    })

    logger.replace("pantries sync’d ⎷")
  } break
  default:
    break // we don’t update if we only just cloned it
  }
}

//FIXME order matters
//NOTE well this overlay method is not permanent for sure
async function co(git: string | Path) {
  for await (const git_dir of ls()) {
    const cmd = [git,
      "--git-dir", git_dir,
      "--work-tree", pantry_dir,
      "checkout",
      "--force"
    ]
    await run({ cmd })
  }
}

export default update

function run(opts: RunOptions) {
  const spin = useFlags().verbosity < 1
  return useRun({ ...opts, spin })
}
