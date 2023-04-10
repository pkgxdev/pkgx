import { Range } from "semver"
import { useFetch, usePrefix } from "hooks"
import { WhichResult } from "types"
import PathUtils from "path-utils"
import useConfig from "./useConfig.ts"

export default function useDarkMagic() {
  return { which }
}

const which = async (arg0: string | undefined): Promise<WhichResult | undefined> => {
  // we only want dark magic with explicit TEA_MAGIC=dark
  const { env } = useConfig()
  if (env.TEA_MAGIC?.toLocaleLowerCase() !== "dark") return undefined

  // Query external providers; return commands to run if found
  const found = await Promise.all([
    npx(arg0),
    pipx(arg0),
    cargo(arg0),
    brew(arg0),
  ])

  // Return the first non-empty result
  return found.find(x => x)
}

const npx = async (arg0: string | undefined) => {
  const res = await useFetch(`https://registry.npmjs.org/${arg0}`)

  if (res.status == 200) {
    return {
      project: "npmjs.com",
      constraint: new Range("*"),
      shebang: ["npx", "-y"],
    }
  }

  return undefined
}

const pipx = async (arg0: string | undefined) => {
  const res = await useFetch(`https://pypi.org/pypi/${arg0}/json`)

  if (res.status == 200) {
    return {
      project: "pypa.github.io/pipx",
      constraint: new Range("*"),
      shebang: ["pipx", "run"],
    }
  }

  return undefined
}

const cargo = async (arg0: string | undefined) => {
  const res = await useFetch(`https://crates.io/api/v1/crates/${arg0}`)

  const binDir = usePrefix().bin
  const exe = binDir.join(arg0!)

  // This only runs the installer if we're not already installed
  const precmd = exe.isExecutableFile() &&
    [
      "cargo",
      "uninstall",
      "--quiet",
      "--root",
      binDir.parent().string,  // installs to {root}/bin
      arg0!,
    ]

  if (res.status == 200) {
    return {
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
const brew = async (arg0: string | undefined) => {
  if (!PathUtils.findBinary("brew")) return undefined

  const res = await useFetch(`https://formulae.brew.sh/api/formula/${arg0}.json`)

  if (res.status == 200) {
    return {
      // FIXME: we should package brew; in the interim
      // we have to return a WhichResult with a project
      project: "tea.xyz",
      constraint: new Range("*"),
      precmd: ["brew", "install", arg0!] // This is safe, since if it were on the path, we'd have found it
    }
  }

  return undefined
}
