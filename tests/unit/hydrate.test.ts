import { assertEquals } from "deno/testing/asserts.ts"
import suite from "../integration.suite.ts"
import { PackageRequirement } from "types"
import * as semver from "utils/semver.ts"
import { it } from "deno/testing/bdd.ts"
import { hydrate } from "prefab"

it(suite, "hydrates.1", async function() {
  const pkgs = [
    { project: 'nodejs.org', constraint: new semver.Range('*') },
    { project: 'nodejs.org', constraint: new semver.Range('>=18.14') }
  ]

  const rv1 = semver.intersect(pkgs[0].constraint, pkgs[1].constraint)
  assertEquals(rv1.toString(), '>=18.14')

  const rv =  await hydrate(pkgs, (_a: PackageRequirement, _b: boolean) => Promise.resolve([]))

  let nodes = 0
  for (const pkg of rv.pkgs) {
    if (pkg.project === 'nodejs.org') {
      nodes++
      assertEquals(pkg.constraint.toString(), '>=18.14')
    }
  }

  assertEquals(nodes, 1)
})

it(suite, "hydrates.2", async function() {
  const pkgs = [
    { project: 'pipenv.pypa.io', constraint: new semver.Range('*') },
    { project: 'python.org', constraint: new semver.Range('~3.9') }
  ]

  const rv = await hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
    if (pkg.project === 'pipenv.pypa.io') {
      return Promise.resolve([
        { project: 'python.org', constraint: new semver.Range('>=3.7') }
      ])
    } else {
      return Promise.resolve([])
    }
  })

  let nodes = 0
  for (const pkg of rv.pkgs) {
    if (pkg.project === 'python.org') {
      assertEquals(pkg.constraint.toString(), '~3.9')
      nodes++
    }
  }

  assertEquals(nodes, 1)
})

it(suite, "hydrates.3", async function() {
  const pkgs = [
    { project: 'pipenv.pypa.io', constraint: new semver.Range('*') },
    { project: 'python.org', constraint: new semver.Range('~3.9') }
  ]

  const rv = await hydrate(pkgs, (pkg: PackageRequirement, _dry: boolean) => {
    if (pkg.project === 'pipenv.pypa.io') {
      return Promise.resolve([
        { project: 'python.org', constraint: new semver.Range('~3.9.1') }
      ])
    } else {
      return Promise.resolve([])
    }
  })

  let nodes = 0
  for (const pkg of rv.pkgs) {
    if (pkg.project === 'python.org') {
      assertEquals(pkg.constraint.toString(), '~3.9.1')
      nodes++
    }
  }

  assertEquals(nodes, 1)
})
