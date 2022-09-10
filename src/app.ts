import useFlags, { useArgs } from "hooks/useFlags.ts"
import useCellar from "hooks/useCellar.ts"
import useMagic from "hooks/useMagic.ts"
import dump from "./app.dump.ts"
import exec from "./app.exec.ts"
import help from "./app.help.ts"
import { Path } from "types"

const rawArgs = useArgs(Deno.args)
const { silent } = useFlags()
const version = '0.0.0-α'

if (rawArgs.cd) {
  const chdir = rawArgs.cd
  console.verbose({ chdir })
  Deno.chdir(chdir.string)
}

try {
  const { mode, ...args } = await useMagic(rawArgs)

  if (mode == "exec") {
    announce()
    await exec(args)
  } else switch (mode[1]) {
    case "env":
      await dump(args)
      break
    case "help":
      await help()
      break
    case "version":
      console.log(`tea ${version}`)
      break
    case "prefix":
      console.log(useCellar().prefix.string)
    }
} catch (err) {
  if (silent) {
    Deno.exit(1)
  } else {
    throw err
  }
}

function announce() {
  const self = new Path(Deno.execPath())
  const prefix = useCellar().prefix.string

  if (self.basename() == "deno") {
    console.verbose({ deno: self.string, prefix, import: import.meta })
  } else {
    console.verbose(`${prefix}/tea.xyz/v${version}/bin/tea`)
  }
}
