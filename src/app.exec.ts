import { useFlags, useShellEnv, usePantry, useExecutableMarkdown } from "hooks"
import { hydrate, resolve, install as base_install, link } from "prefab"
import { VirtualEnv } from "hooks/useVirtualEnv.ts"
import { PackageSpecification } from "types"
import { run, undent } from "utils"
import Path from "path"

type Options = {
  args: string[]
  env: VirtualEnv | undefined
  pkgs: PackageSpecification[]
}

export default async function exec({ args, ...opts }: Options) {
  const flags = useFlags()

  if (args.length < 1) throw new Error("contract violation")

  const installations = await install(opts.pkgs)

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

  const env = useShellEnv(installations).combinedStrings
  if (opts.env) {
    env["SRCROOT"] = opts.env.srcroot.string
    if (opts.env.version) env["VERSION"] = opts.env.version.toString()
  }
  if (flags.json) {
    env["JSON"] = "1"
  }

  const cmd = [...args]
  await run({ cmd, env })  //TODO implement `execvp`
}

/////////////////////////////////////////////////////////////
async function install(dry: PackageSpecification[]) {
  const get = (x: PackageSpecification) => usePantry().getDeps(x).then(x => x.runtime)
  const wet = await hydrate(dry, get)   ; console.debug({wet})
  const gas = await resolve(wet.pkgs)   ; console.debug({gas})

  for (const pkg of gas.pending) {
    console.info({ installing: pkg })
    const installation = await base_install(pkg)
    await link(installation)
    gas.installed.push(installation)
  }
  return gas.installed
}
