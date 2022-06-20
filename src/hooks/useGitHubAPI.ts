import { RELOAD_POLICY } from "https://raw.githubusercontent.com/mxcl/deno-cache/main/mod.ts";
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
      //TODO should be explicit if you want coerce
      const raw_version = (tag_name ?? name ?? "").replace(/-/, '+')
      if (ignoredVersions?.some(v => raw_version.match(v))) { return undefined }

      // This isn't great, but per-package versions.ts support will allow us to use strict parsing throughout
      return flatMap(raw_version, x => semver.parse(x) || semver.coerce(x))
    }, { throws: true })
  }
  return { getVersions }
}
