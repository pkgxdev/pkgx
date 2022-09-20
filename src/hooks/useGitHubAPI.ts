import { GET, undent, validate_arr, validate_str } from "utils"
import { isArray } from "is_what"

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
  return { getVersions }
}

async function getVersions({ user, repo, type }: GetVersionsOptions): Promise<string[]> {
  //TODO set `Accept: application/vnd.github+json`
  //TODO we can use ETags to check if the data we have cached is still valid

  if (type.startsWith("releases")) {
    const json = await GET<GHRelease[]>(`https://api.github.com/repos/${user}/${repo}/releases?per_page=100`)
    if (!isArray(json)) throw "unexpected json"
    return json.map(({ tag_name, name }) => type == 'releases/tags' ? tag_name : name)
  } else {
    // github tags API returns in reverse alphabetical order lol
    // so we have to use their graphql endpoint
    // sadly the graph ql endpoint requires auth :/

    //NOTE realistically the bad sort order for the REST api only effects ~5% of projects
    // so potentially could flag those projects (eg. go.dev)

    const headers: HeadersInit = {}
    const token = Deno.env.get("GITHUB_TOKEN")
    if (token) headers['Authorization'] = `bearer ${token}`

    const query = undent`
      query {
        repository(owner: "${user}", name: "${repo}") {
          refs(last: 100, refPrefix: "refs/tags/", orderBy: {field: TAG_COMMIT_DATE, direction: ASC}) {
            nodes {
              name
            }
          }
        }
      }`
    const rsp = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      body: JSON.stringify({ query }),
      headers
    })
    const json = await rsp.json()

    if (!rsp.ok) {
      console.error({ rsp, json })
      throw new Error()
    } else {
      console.debug(json)
    }

    // deno-lint-ignore no-explicit-any
    const foo = validate_arr(json?.data?.repository?.refs?.nodes).map((x: any) => validate_str(x?.name))

    return foo
  }
}
