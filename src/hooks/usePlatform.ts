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
    if (platform == 'darwin') {
      /// for now, prevent gatekeeper prompts FIXME sign everything!

      // using find because it doesn’t error if it fails
      // and it does fail if the file isn’t writable, but we don’t want to make everything writable
      // unless we are forced into that in the future

      const cmd = [
        'find', install.path,
          '-xattrname', 'com.apple.quarantine',
          '-perm', '-0200',  // only if we can write (prevents error messages)
          '-exec', 'xattr', '-d', 'com.apple.quarantine', '{}', ';'
      ]

      await run({ cmd })
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
