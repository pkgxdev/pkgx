import { Range } from "semver"
import { useFetch } from "hooks"

export default function useDarkMagic() {
  return { which }
}

const which = async (arg0: string | undefined) => {
  // Query external providers; return commands to run if found
  const found = await Promise.all([
    npx(arg0),
    pipx(arg0),
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
      shebang: ["npx", "-y"]
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
      shebang: ["pipx", "run"]
    }
  }

  return undefined
}
