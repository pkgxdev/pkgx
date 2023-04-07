import { Range } from "semver"
import { useFetch, usePrefix } from "hooks"
import { WhichResult } from "types"

export default function useDarkMagic() {
  return { which }
}

const which = async (arg0: string | undefined): Promise<WhichResult | undefined> => {
  // Query external providers; return commands to run if found
  const found = await Promise.all([
    npx(arg0),
    pipx(arg0),
    cargo(arg0),
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

  if (res.status == 200) {
    return {
      project: "rust-lang.org/cargo",
      constraint: new Range("*"),
      explicit: binDir.join(arg0!),
      precmd: [
        "cargo",
        "install",
        "--quiet",
        "--root",
        binDir.parent().string, // installs to {root}/bin
        arg0!,
      ]
    }
  }

  return undefined
}
