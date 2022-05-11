import { PackageRequirement } from "types"
import useCellar from "hooks/useCellar.ts"

type Env = Record<string, string[]>
export const EnvKeys = ['PATH', 'MANPATH', 'PKG_CONFIG_PATH']

interface Response {
  vars: Env
  defaults: Env
  combined: Env
  combinedStrings: Record<string, string>
  pending: PackageRequirement[]
}

//TODO | Installation[] (quicker)

export default async function useShellEnv(requirements: PackageRequirement[]): Promise<Response> {
  const cellar = useCellar()
  const vars: Env = {}
  const pending: PackageRequirement[] = []

  for (const requirement of requirements) {
    const installation = await cellar.resolve(requirement).swallow(/^not-found:/)

    if (!installation) {
      pending.push(requirement)
    } else for (const key of EnvKeys)
      for (const suffix of suffixes(key)!) {
        if (!vars[key]) vars[key] = []
        vars[key].compactUnshift(installation.path.join(suffix).compact()?.string)
      }
  }

  const defaults: Env = {}
  const combined: Env = {}
  const combinedStrings: Record<string, string> = {}
  for (const key of EnvKeys) {
    const defaultValue = Deno.env.get(key)
      ?.split(":")
      ?.filter(x => !x.startsWith("/opt")) ?? [] //FIXME /opt is not ours
    defaults[key] = defaultValue
    combined[key] = (vars[key] ?? []).concat(defaultValue)
    combinedStrings[key] = combined[key].join(":")
  }

  return { vars, defaults, combined, combinedStrings, pending }
}

function suffixes(key: string) {
  switch (key) {
    case 'PATH':
      return ["bin", "sbin"]
    case 'MANPATH':
      return ["share/man"]
    case 'PKG_CONFIG_PATH':
      return ['share/pkgconfig', 'lib/pkgconfig']
  }
}
