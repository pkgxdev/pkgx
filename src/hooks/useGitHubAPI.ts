import { RELOAD_POLICY } from "mxcl/deno-cache";
import { semver, SemVer } from "types"
import { flatMap, GET } from "utils"

//TODO pagination

interface GetVersionsOptions {
  user: string
  repo: string
  ignoredVersions?: RegExp[]
}

interface Response {
  getVersions(opts: GetVersionsOptions): Promise<SemVer[]>
}

interface GHRelease {
  tag_name?: string
  name?: string
}

export default function useGitHubAPI(): Response {
  const getVersions = async ({ user, repo, ignoredVersions }: GetVersionsOptions) => {
    const releases = await GET<GHRelease[]>(`https://api.github.com/repos/${user}/${repo}/releases`, RELOAD_POLICY)
    // All of this will be moot once we implement proper version-mapping per package
    return releases.compactMap(({ tag_name, name }) => {
      const raw_version = (tag_name ?? name ?? "")
      if (ignoredVersions?.some(v => raw_version.match(v))) { return undefined }
      const munged_raw = raw_version.replace(/-/, '+')

      // This isn't great, but per-package versions.ts support will allow us to use strict parsing throughout
      // coerce is much looser, and misses things like build IDs and
      // pre-release identifiers
      return flatMap(munged_raw, x => semver.parse(x) || semver.coerce(x))
    }, { throws: true })
  }
  return { getVersions }
}
