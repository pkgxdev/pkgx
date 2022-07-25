import { RELOAD_POLICY } from "mxcl/deno-cache";
import { semver, SemVer } from "types"
import { GET, isArray } from "utils"

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
    const releases = await fetch_releases() ?? await fetch_tags() ?? []

    // All of this will be moot once we implement proper version-mapping per package
    return releases
      .compactMap(({ tag_name, name }) =>
        v(name) ?? v(tag_name),
        { throws: true })

    async function fetch_releases(): Promise<GHRelease[] | undefined> {
      const json = await GET<GHRelease[]>(`https://api.github.com/repos/${user}/${repo}/releases?per_page=100`, RELOAD_POLICY)
      if (!isArray(json)) throw "unexpected json"
      return json.chuzzle()
    }
    async function fetch_tags(): Promise<GHRelease[] | undefined> {
      const json = await GET<GHRelease[]>(`https://api.github.com/repos/${user}/${repo}/tags?per_page=100`, RELOAD_POLICY)
      if (!isArray(json)) throw "unexpected json"
      return json.chuzzle()
    }

    function v(input: string | undefined) {
      try {
        if (!input) return
        // This isn't great, but per-package versions.ts support will allow us to use strict parsing throughout
        // coerce is much looser, and misses things like build IDs and
        // pre-release identifiers
        const foundv = semver.parse(input) || semver.coerce(input.replace(/-/, '+'))
        if (input && foundv && ignoredVersions?.some(v => input.match(v))) {
          console.debug({ignoring: foundv.toString(), from: input})
        } else if (foundv) {
          console.debug({found: foundv.toString(), from: input})
          return foundv
        }
      } catch {
        //NOOP
      }
      console.debug({unparsable: input})
    }
  }
  return { getVersions }
}
