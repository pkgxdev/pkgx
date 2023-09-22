import { hooks } from "pkgx"
const { usePantry } = hooks

export default async function(args: string[]) {
  const pantry = usePantry()
  const rv: string[] = []
  const promises: Promise<void>[] = []
  for await (const entry of pantry.ls()) {
    const project = pantry.project(entry)
    const promise = project.provides().then(provides => {
      for (const provide of provides) {
        if (provide.startsWith(args[0])) {
          rv.push(provide)
          return
        }
      }
    })
    promises.push(promise)
  }

  await Promise.all(promises)

  return rv
}
