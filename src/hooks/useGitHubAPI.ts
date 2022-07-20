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
      console.debug({ tag_name, name })
      const [v1, v2] = [v(tag_name), v(name)]
      // v2 first as it is more likely the name of the release is well-named
      return v2 ?? v1
    }, { throws: true })

    function v(input: string | undefined) {
      try {
        // This isn't great, but per-package versions.ts support will allow us to use strict parsing throughout
        // coerce is much looser, and misses things like build IDs and
        // pre-release identifiers
        const foundv = flatMap(input, x => semver.parse(x) || semver.coerce(x.replace(/-/, '+')))
        if (input && foundv && ignoredVersions?.some(v => input.match(v))) { return }
        return foundv
      } catch {
        //NOOP
      }
    }
  }
  return { getVersions }
}
