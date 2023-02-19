import { assertEquals } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import * as semver from "utils/semver.ts"
import { it } from "deno/testing/bdd.ts"
import { hydrate } from "prefab"

const pkgs = [
  { project: 'nodejs.org', constraint: new semver.Range('*') },
  { project: 'nodejs.org', constraint: new semver.Range('>=18.14') }
]

it(suite, "hydrates", async function() {
  const rv1 = semver.intersect(pkgs[0].constraint, pkgs[1].constraint)
  assertEquals(rv1.toString(), '>=18.14')

  this.run({ args: ['--sync'] })

  const rv =  await hydrate(pkgs)

  let nodes = 0
  for (const pkg of rv.pkgs) {
    if (pkg.project === 'nodejs.org') {
      nodes++
      assertEquals(pkg.constraint.toString(), '>=18.14')
    }
  }

  assertEquals(nodes, 1)
})
