import { RELOAD_POLICY } from "mxcl/deno-cache";
import { GET, isArray } from "utils"

//TODO pagination

interface GetVersionsOptions {
  user: string
  repo: string
  type: 'releases' | 'tags' | 'releases/tags'
}

interface Response {
  getVersions(opts: GetVersionsOptions): Promise<string[]>
}

interface GHRelease {
  tag_name: string
  name: string
}

export default function useGitHubAPI(): Response {
  const getVersions = async ({ user, repo, type }: GetVersionsOptions) => {
    const endpoint = type.startsWith("releases") ? 'releases' : 'tags'
    const json = await GET<GHRelease[]>(`https://api.github.com/repos/${user}/${repo}/${endpoint}?per_page=100`, RELOAD_POLICY)
    if (!isArray(json)) throw "unexpected json"
    return json.map(({ tag_name, name }) => type == 'releases/tags'
      ? tag_name
      : name
    )
  }

  return { getVersions }
}
