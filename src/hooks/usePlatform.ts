//lol FIXME

import { Installation } from "types";
import { run } from "utils";

interface Return {
  platform: 'darwin' | 'linux' | 'windows'
  arch: 'x86-64' | 'aarch64'
  target: string
  buildIdentifiers: string[]

  finalizeInstall: (install: Installation) => Promise<void>
}

export default function usePlatform(): Return {
  const arch = (() => {
    switch (Deno.build.arch) {
      case "aarch64": return "aarch64"
      case "x86_64": return "x86-64"
      // ^^ ∵ https://en.wikipedia.org/wiki/X86-64 and semver.org prohibits underscores
    }
  })()
  const { os: platform, target } = Deno.build

  const finalizeInstall = async (install: Installation) => {
    switch (platform) {
      case 'darwin':
        /// for now, prevent gatekeeper prompts FIXME sign everything!
        await run({ cmd: ['xattr', '-rd', 'com.apple.quarantine', install.path.string] })
    }
  }

  return {
    platform,
    arch,
    target,
    buildIdentifiers: [platform, arch],
    finalizeInstall,
  }
}
