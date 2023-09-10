import { isString } from "is-what"
import { TeaError } from "tea"
import undent from "outdent"

export class AmbiguityError extends TeaError {
  projects: string[]
  arg0: string

  constructor(arg0: string, pkgs: { project: string }[]) {
    const projects = pkgs.map(x => x.project)
    super(undent`
      multiple projects provide \`${arg0}\`. please be more specific:

      ${projects.map(p => `    tea +${p} ${Deno.args.join(' ')}`).join('\n')}
      `)
    this.projects = projects
    this.arg0 = arg0
  }
}

export class ProvidesError extends TeaError {
  constructor(arg0: string) {
    //TODO if arg0 is in the parent PATH then scan it and find it
    //TODO render errors with markdown there must be a pkg for that

    super(undent`
      # nothing provides \`${arg0}\`

      > we haven’t pkgd this yet, can you add it to the pantry? [docs.tea.xyz/pantry]
      `)

    this.arg0 = arg0
  }

  arg0: string
}

export class UsageError extends TeaError {
  constructor(arg: string | {msg: string}) {
    let msg: string
    if (isString(arg)) {
      msg = `no such arg: ${arg}`
    } else {
      msg = arg.msg
    }
    super(`usage error: ${msg}`)
  }
}

export class ProgrammerError extends Error
{}
