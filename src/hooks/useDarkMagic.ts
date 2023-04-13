import { Range } from "semver"
import { useDb, useFetch, usePrefix, useConfig } from "hooks"
import { WhichResult } from "types"
import PathUtils from "path-utils"
import Path from "../vendor/Path.ts"

export default function useDarkMagic() {
  return { which }
}

const which = async (arg0: string | undefined): Promise<WhichResult | undefined> => {
  if (!arg0) return undefined

  // we only want dark magic with explicit TEA_MAGIC=dark
  const { env } = useConfig()
  if (env.TEA_MAGIC?.toLocaleLowerCase() !== "dark") return undefined

  const db = new useDb()
  const previous = db.findDarkMagicChoice(arg0)?.provider
  if (previous) return provider_calls[previous](arg0)

  // Query external providers; return commands to run if found
  const found = (await Promise.all(Object.values(provider_calls).map(p => p(arg0)))).filter(x => x)

  if (found.length === 0) return undefined
  if (found.length === 1) return found[0]

  console.info(`Multiple providers found for \`${arg0}\`\nPlease choose one:`)
  const res = await Deno.run({ cmd: ["tea", "gum", "choose", ...found.map(f => f!.provider)], stdout: "piped" })

  const pick = new TextDecoder().decode(await res.output())

  db.setDarkMagicChoice(arg0, pick.trim() as Provider)

  // Return the first non-empty result
  return found.find(x => x?.provider === pick.trim())
}

const npx = async (arg0: string) => {
  const res = await useFetch(`https://registry.npmjs.org/${arg0}`)

  if (res.status == 200) {
    return {
      provider: Provider.npm,
      project: "npmjs.com",
      constraint: new Range("*"),
      shebang: ["npx", "-y"],
    }
  }

  return undefined
}

const pipx = async (arg0: string) => {
  const res = await useFetch(`https://pypi.org/pypi/${arg0}/json`)

  if (res.status == 200) {
    return {
      provider: Provider.pip,
      project: "pypa.github.io/pipx",
      constraint: new Range("*"),
      shebang: ["pipx", "run"],
    }
  }

  return undefined
}

const cargo = async (arg0: string) => {
  const res = await useFetch(`https://crates.io/api/v1/crates/${arg0}`)

  const binDir = usePrefix().bin
  const exe = binDir.join(arg0)

  // This only runs the installer if we're not already installed
  const precmd = (() => {
    if (!exe.isExecutableFile())
      return [
        "cargo",
        "install",
        "--quiet",
        "--root",
        binDir.parent().string,  // installs to {root}/bin
        arg0,
      ]
  })()

  if (res.status == 200) {
    return {
      provider: Provider.cargo,
      project: "rust-lang.org/cargo",
      constraint: new Range("*"),
      explicit: exe,
      precmd,
    }
  }

  return undefined
}

// Installs will also end up outside tea's prefix, so they won't be removed by
// uninstall. So maybe this is fine?

// also FIXME: once you _execute_ brew install, `--provides` returns false,
// since it's in the path at that point. But I doubt uninstalling after
// run is the right answer.
const brew = async (arg0: string) => {
  const brew = new Path("/opt/homebrew/bin/brew").isExecutableFile() ?? new Path("/usr/local/bin/brew").isExecutableFile()

  if (!brew) return

  const explicit = brew.parent().join(arg0)
  const isInstalled = explicit.isExecutableFile()
  const precmd = !isInstalled ? [brew.string, "install", arg0] : undefined

  const rv = {
    provider: Provider.brew,
    // FIXME: we should package brew; in the interim
    // we have to return a WhichResult with a project
    project: "tea.xyz",
    constraint: new Range("*"),
    explicit,
    precmd
  }

  if (isInstalled) {
    return rv
  } else {
    const res = await useFetch(`https://formulae.brew.sh/api/formula/${arg0}.json`)
    if (res.status == 200) return rv
  }
}

export enum Provider {
  npm = "npm",
  pip = "pip",
  cargo = "cargo",
  brew = "brew",
}

const provider_calls = {
  [Provider.npm]: npx,
  [Provider.pip]: pipx,
  [Provider.cargo]: cargo,
  [Provider.brew]: brew,
}
