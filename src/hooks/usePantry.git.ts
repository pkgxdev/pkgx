import { useDownload, usePrefix, useCellar } from "hooks"
import * as semver from "semver"
import { run } from "utils"
import Path from "path"

export const prefix = usePrefix().join('tea.xyz/var/pantry/projects')

async function find_git(): Promise<Path | undefined> {
  for (const path_ of Deno.env.get('PATH')?.split(':') ?? []) {
    const path = Path.root.join(path_, 'git')
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

const pantry_dir = prefix.parent()
const pantries_dir = pantry_dir.parent().join("pantries")

let avoid_softlock = false

async function lock<T>(body: () => Promise<T>) {
  if (avoid_softlock) throw new Error("aborting to prevent softlock")
  avoid_softlock = true

  const { rid } = Deno.openSync(pantry_dir.mkpath().string)
  await Deno.flock(rid, true)

  try {
    return await body()
  } finally {
    //TODO if this gets stuck then nothing will work so need a handler for that
    await Deno.funlock(rid)
    avoid_softlock = false
  }
}

//TODO we have a better system in mind than git
export async function install(): Promise<true | 'not-git' | 'noop' | 'deprecated'> {
  if (prefix.exists()) {
    if (pantries_dir.exists()) return 'noop'
    if (pantry_dir.join('.git').exists()) return 'deprecated'

    // FIXME in this case we have a downloaded pantry so we should install git
    return 'not-git'
  }

  try {
    const git = await find_git()

    return await lock(async () => {
      if (prefix.exists()) return 'noop'
      // ^^ another instance of tea did the install while we waited

      if (git) {
        await clone(git)
        return true
      } else {
        await unzip()
        return 'not-git'
      }
    })
  } catch (e) {
    pantries_dir.rm({ recursive: true }) // leave us in a blank state
    pantry_dir.rm({ recursive: true })   // ^^
    throw e
  }

  async function clone(git: Path) {
    const pp: Promise<void>[] = []
    for (const name of ["pantry.core", "pantry.extra"]) {
      const p = run({
        cmd: [
          git, "clone",
            "--bare", "--depth=1",
            `https://github.com/teaxyz/${name}`,
            pantries_dir.join("teaxyz").mkpath().join(name)
        ]
      })
      pp.push(p)
    }

    await Promise.all(pp)
    await co(git)
  }

  async function unzip() {
    //FIXME if we do this, we need to be able to convert it to a git installation later
    //TODO use our tar if necessary
    //TODO if we keep this then don’t store the files, just pipe to tar
    for (const name of ["pantry.core", "pantry.extra"]) {
      const src = new URL(`https://github.com/teaxyz/${name}/archive/refs/heads/main.tar.gz`)
      const tgz = await useDownload().download({ src })
      const cwd = pantry_dir.mkpath()
      await run({cmd: ["tar", "xzf", tgz, "--strip-components=1"], cwd })
    }
  }
}

async function *ls() {
  for await (const [user] of pantries_dir.ls()) {
    for await (const [repo] of user.ls()) {
      yield repo
    }
  }
}

export const update = async () => {
  switch (await install()) {
  case 'deprecated':
    console.warn("pantry is a clone, this is deprecated, please clean-install tea")
    break
  case 'not-git':
    console.warn("pantry is not a git repository, cannot update")
    break
  case 'noop': {
    const git = await find_git()
    if (!git) return console.warn("cannot update pantry without git")
    const pp: Promise<void>[] = []
    for await (const cwd of ls()) {
      const p = run({cmd: [git, "fetch", "origin"], cwd })
      pp.push(p)
    }
    await Promise.all(pp)
    await co(git)
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
