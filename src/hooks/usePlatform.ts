//lol FIXME

interface Return {
  platform: 'darwin' | 'linux' | 'windows'
  arch: 'x86_64' | 'aarch64'
  target: string
  semver: string
}

export default function usePlatform(): Return {
  return {
    platform: Deno.build.os,
    arch: Deno.build.arch,
    target: Deno.build.target,
    semver: Deno.build.target.replaceAll(/_/g, '-')
  }
}
