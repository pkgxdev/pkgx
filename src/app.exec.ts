import { useFlags, useCellar, useShellEnv, usePantry, useExecutableMarkdown } from "hooks"
import { VirtualEnv } from "hooks/useVirtualEnv.ts"
import { run, undent } from "utils"
import { PackageRequirement } from "types"
import { hydrate, resolve, install as base_install, link } from "prefab"
import Path from "path"

type Options = {
  args: string[]
  env: VirtualEnv | undefined
  pkgs: PackageRequirement[]
}

export default async function exec({ args, ...opts }: Options) {
  const cellar = useCellar()
  const flags = useFlags()

  if (args.length < 1) throw "contract violation"

  await install(opts.pkgs)

  const filename = Path.cwd().join(args[0]).isFile()
  if (filename?.extname() == '.md') {
    const target = args[1]
    const sh = await useExecutableMarkdown({ filename }).findScript(target)
    const path = Path.mktmp().join('script').write({ text: undent`
      #!/bin/sh
      ${sh}
      ` }).chmod(0o500).string
    args = [path, ...args.slice(2)]
  }

  const env = (await useShellEnv(opts.pkgs)).combinedStrings
  if (opts.env) {
    env["SRCROOT"] = opts.env.srcroot.string
    if (opts.env.version) env["VERSION"] = opts.env.version.toString()
  }
  if (flags.json) {
    env["JSON"] = "1"
  }

  const cmd = [...args]
  await run({ cmd, env })  //TODO implement `execvp`

/////////////////////////////////////////////////////////////
  async function install(dry: PackageRequirement[]) {
    const get = (x: PackageRequirement) => usePantry().getDeps(x).then(x => x.runtime)
    const wet = await hydrate(dry, get)   ; console.debug({wet})
    const gas = await resolve(wet.pkgs)   ; console.debug({gas})
    for (const pkg of gas) {
      if (await cellar.has(pkg)) continue
      console.info({ installing: pkg })
      const installation = await base_install(pkg)
      await link(installation)
    }
  }
}
