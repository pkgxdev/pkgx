import SemVer from "semver"
import { host } from "utils"

export default function useMoustaches() {
  return {
    apply,
    tokenize: {
      version: tokenizeVersion,
      host: tokenizeHost
    }
  }
}

function tokenizeVersion(version: SemVer, prefix = 'version') {
  const rv = [
    { from:    prefix,             to: `${version}` },
    { from: `${prefix}.major`,     to: `${version.major}` },
    { from: `${prefix}.minor`,     to: `${version.minor}` },
    { from: `${prefix}.patch`,     to: `${version.patch}` },
    { from: `${prefix}.marketing`, to: `${version.major}.${version.minor}` },
    { from: `${prefix}.build`,     to: version.build.join('+') },
    { from: `${prefix}.raw`,       to: version.raw },
  ]
  if ('tag' in version) {
    rv.push({from: `${prefix}.tag`, to: (version as unknown as {tag: string}).tag})
  }
  return rv
}

//TODO replace `hw` with `host`
function tokenizeHost() {
  const { arch, target, platform } = host()
  return [
    { from: "hw.arch",        to: arch },
    { from: "hw.target",      to: target },
    { from: "hw.platform",    to: platform },
    { from: "hw.concurrency", to: navigator.hardwareConcurrency.toString() }
  ]
}

function apply(input: string, map: { from: string, to: string }[]) {
  return map.reduce((acc, {from, to}) =>
    acc.replace(new RegExp(`(^\\$)?{{\\s*${from}\\s*}}`, "g"), to),
    input)
}
