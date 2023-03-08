import { GET2, undent, validate_arr, validate_str } from "utils"
import { isArray } from "is_what"
import { useFetch } from "hooks";

//TODO pagination

interface GetVersionsOptions {
  user: string
  repo: string
  type: 'releases' | 'tags' | 'releases/tags'
}

interface GHRelease {
  tag_name: string
  name: string
}

export default function useGitHubAPI() {
  return { getVersions }
}

async function *getVersions({ user, repo, type }: GetVersionsOptions): AsyncGenerator<string> {
  //TODO set `Accept: application/vnd.github+json`
  //TODO we can use ETags to check if the data we have cached is still valid

  let ismore = false

  if (type.startsWith("releases")) {
    let page = 0
    do {
      page++
      const [json, rsp] = await GET2<GHRelease[]>(`https://api.github.com/repos/${user}/${repo}/releases?per_page=100&page=${page}`)
      if (!isArray(json)) throw new Error("unexpected json")
      for (const str of json.map(({ tag_name, name }) => type == 'releases/tags' ? tag_name : name)) {
        yield str
      }

      const linkHeader = (rsp.headers as unknown as {link: string}).link
      ismore = linkHeader ? linkHeader.includes(`rel=\"next\"`) : false
    } while (ismore)
  } else {
    // GitHub tags API returns in reverse alphabetical order lol
    // so we have to use their graphql endpoint
    // sadly the graph ql endpoint requires auth :/

    //NOTE realistically the bad sort order for the REST api only effects ~5% of projects
    // so potentially could flag those projects (eg. go.dev)

    let before = "null"

    do {
      const headers: HeadersInit = {}
      const token = Deno.env.get("GITHUB_TOKEN")
      if (token) headers['Authorization'] = `bearer ${token}`

      const query = undent`
        query {
          repository(owner: "${user}", name: "${repo}") {
            refs(last: 100, before: ${before}, refPrefix: "refs/tags/", orderBy: {field: TAG_COMMIT_DATE, direction: ASC}) {
              nodes {
                name
              }
              pageInfo {
                hasPreviousPage
                startCursor
              }
            }
          }
        }`
      const rsp = await useFetch('https://api.github.com/graphql', {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers
      })
      const json = await rsp.json()

      if (!rsp.ok) {
        console.error({ rsp, json })
        throw new Error()
      }

      // deno-lint-ignore no-explicit-any
      const foo = validate_arr(json?.data?.repository?.refs?.nodes).map((x: any) => validate_str(x?.name))

      for (const bar of foo) {
        yield bar
      }

      ismore = json?.data?.repository?.refs?.pageInfo?.hasPreviousPage || false
      before = `"${json?.data?.repository?.refs?.pageInfo?.startCursor}"`

    } while (ismore)
  }
}
