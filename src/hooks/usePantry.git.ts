import { flatten } from "./useShellEnv.ts"
import { useDownload, usePrefix } from "hooks"
import { run } from "utils"
import Path from "path"

export const prefix = usePrefix().join('tea.xyz/var/pantry/projects')

function find_git(): Promise<[Path | string, Record<string, string[]>] | undefined> {
  for (const path_ of Deno.env.get('PATH')?.split(':') ?? []) {
    const path = Path.root.join(path_, 'git')
    if (path.isExecutableFile()) {
      return Promise.resolve([path, {}])
    }
  }

  return Promise.resolve(undefined)

  //ALERT! don’t install git with tea
  // we tried that, but there's no pantry yet, so attempting to do it will
  // lead to a recursive loop here
}

const pantry_dir = prefix.parent()
const pantries_dir = pantry_dir.parent().join("pantries")

async function lock<T>(body: () => Promise<T>) {
  const { rid } = Deno.openSync(pantry_dir.mkpath().string)
  await Deno.flock(rid, true)

  try {
    return await body()
  } finally {
    //TODO if this gets stuck then nothing will work so need a handler for that
    await Deno.funlock(rid)
  }
}

//TODO we have a better system in mind than git
export async function install(): Promise<true | 'not-git' | 'noop' | 'deprecated'> {
  if (prefix.exists()) {
    if (pantries_dir.exists()) return 'noop'
    return pantry_dir.join('.git').exists()
      ? 'deprecated' // tmp to do internal fix
      : 'not-git'
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

  async function clone([git, preenv]: [Path | string, Record<string, string[]>]) {
    const env = flatten(preenv)

    const pp: Promise<void>[] = []
    for (const name of ["pantry.core", "pantry.extra"]) {
      const p = run({
        cmd: [
          git, "clone",
            "--bare", "--depth=1",
            `https://github.com/teaxyz/${name}`,
            pantries_dir.join("teaxyz").mkpath().join(name)
        ],
        env
      })
      pp.push(p)
    }

    await Promise.all(pp)
    await co(git, env)
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
    const env = flatten(git[1])
    const pp: Promise<void>[] = []
    for await (const cwd of ls()) {
      const p = run({cmd: [git[0], "fetch", "origin"], cwd, env })
      pp.push(p)
    }
    await Promise.all(pp)
    await co(git[0], env)
  } break
  default:
    break // we don’t update if we only just cloned it
  }
}

//FIXME order matters
//NOTE well this overlay method is not permanent for sure
async function co(git: string | Path, env: Record<string, string>) {
  for await (const git_dir of ls()) {
    const cmd = [git,
      "--git-dir", git_dir,
      "--work-tree", pantry_dir,
      "checkout",
      "--force"
    ]
    await run({ cmd, env })
  }
}
