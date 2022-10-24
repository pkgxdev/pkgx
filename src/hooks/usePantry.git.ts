import { install as tea_install, hydrate, resolve } from "prefab"
import { flatten } from "./useShellEnv.ts"
import { useDownload, useShellEnv, usePrefix } from "hooks"
import * as semver from "semver"
import { run } from "utils"
import Path from "path"

export const prefix = usePrefix().join('tea.xyz/var/pantry/projects')

async function find_git(): Promise<[Path | string, Record<string, string[]>] | undefined> {
  for (const path_ of Deno.env.get('PATH')?.split(':') ?? []) {
    const path = Path.root.join(path_, 'git')
    if (path.isExecutableFile()) {
      return [path, {}]
    }
  }

  try {
    const installations = await (async () => {
      const { pkgs: wet } = await hydrate({ project: 'git-scm.org', constraint: new semver.Range('*') })
      const { pending: gas, installed } = await resolve(wet)
      return [
        ...await Promise.all(gas.map(tea_install)),
        ...installed
      ]
    })()
    const env = useShellEnv({ installations })
    return ['git', env]
  } catch (err) {
    console.warn(err)
  }
}

const pantry_dir = prefix.parent()
const pantries_dir = pantry_dir.parent().join("pantries")

//TODO we have a better system in mind than git
export async function install(): Promise<true | 'not-git' | 'noop' | 'deprecated'> {
  if (pantries_dir.exists()) return 'noop'
  if (prefix.exists()) {
    return pantry_dir.join('.git').exists()
      ? 'deprecated' // tmp to do internal fix
      : 'not-git'
  }

  try {
    const { rid } = Deno.openSync(pantry_dir.mkpath().string)
    await Deno.flock(rid, true)
    try {
      if (prefix.exists()) return 'noop'
      // ^^ another instance of tea did the install while we waited

      const git = await find_git()
      if (git) {
        await clone(git)
        return true
      } else {
        await unzip()
        return 'not-git'
      }
    } finally {
      //TODO if this gets stuck then nothing will work so need a handler for that
      await Deno.funlock(rid)
    }
  } catch (e) {
    pantries_dir.rm({ recursive: true }) // leave us in a blank state
    pantry_dir.rm({ recursive: true })   // ^^
    throw e
  }

  async function clone([git, preenv]: [Path | string, Record<string, string[]>]) {
    const env = flatten(preenv)

    const pp: Promise<void>[] = []
    for (const [remote, local] of [["pantry", "pantry.core"], ["pantry.extra", "pantry.extra"]]) {
      const p = run({
        cmd: [
          git, "clone",
            "--bare", "--depth=1",
            `https://github.com/teaxyz/${remote}`,
            pantries_dir.join("teaxyz").mkpath().join(local)
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
    for (const name of ["pantry", "pantry.extra"]) {
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
    console.warn("pantry is a clone, this is deprecated, cannot update, please reinstall")
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
