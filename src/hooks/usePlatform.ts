//lol FIXME

interface Return {
  platform: 'darwin' | 'linux' | 'windows'
  arch: 'x86-64' | 'aarch64'
  target: string
  semver: string
}

export default function usePlatform(): Return {
  const arch = (() => {
    switch (Deno.build.arch) {
      case "aarch64": return "aarch64"
      case "x86_64": return "x86-64"
      // ^^ ∵ https://en.wikipedia.org/wiki/X86-64 and semver.org prohibits underscores
    }
  })()
  return {
    platform: Deno.build.os,
    arch,
    target: Deno.build.target,
    semver: Deno.build.target.replaceAll(/_/g, '-')
  }
}
