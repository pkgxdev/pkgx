import { semver, SemVer } from "types"
import { flatMap, GET } from "utils"

//TODO pagination

interface GetVersionsOptions {
  user: string
  repo: string
}

interface Response {
  getVersions(opts: GetVersionsOptions): Promise<SemVer[]>
}

interface GHRelease {
  tag_name?: string
  name?: string
}

export default function useGitHubAPI(): Response {
  const getVersions = async ({ user, repo }: GetVersionsOptions) => {
    const releases = await GET<GHRelease[]>(`https://api.github.com/repos/${user}/${repo}/releases`, { maxAge: 3600, strict: true })
    return releases.compactMap(({ tag_name, name }) => {
      //TODO should be explicit if you want coerce
      return flatMap(tag_name ?? name, x => semver.coerce(x))
    }, { throws: true })
  }
  return { getVersions }
}
