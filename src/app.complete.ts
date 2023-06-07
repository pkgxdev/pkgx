import { usePrint } from "hooks"
import { hooks } from "tea"
const { usePantry } = hooks

export default async function complete(prefix: string | undefined) {
  if (!prefix) return

  const pantry = usePantry()
  const { print } = usePrint()

  const completions = new Set<string>()

  for await (const project of pantry.ls()) {
    const provides = await pantry.project(project).provides()
    for (const bin of provides) {
      if (bin.startsWith(prefix)) completions.add(bin)
    }
  }

  if (completions.size) await print([...completions].sort().join('\n'))
}