import { PlainObject } from "is_what"
import { undent } from "utils"

type ID =
  'not-found: tea -X: arg0' |
  'not-found: exe/md: default target' |
  'not-found: exe/md: region' |
  'not-found: pkg.version' |
  'http' |
  'not-found: pantry' |
  'not-found: pantry: package.yml' |
  'parser: pantry: package.yml' |
  'not-found: dev-env' |
  // 'not-found: srcroot' |
  'not-found: arg' |
  '#helpwanted'

export default class TeaError extends Error {
  id: ID
  ctx: PlainObject

  code() {
    switch (this.id) {
      case 'not-found: tea -X: arg0': return 'spilt-tea-001'
      case 'not-found: exe/md: default target': return 'spilt-tea-002'
      case 'not-found: exe/md: region': return 'spilt-tea-003'
      case 'not-found: pkg.version': return 'spilt-tea-004'
      case 'not-found: pantry: package.yml': return 'spilt-tea-005'
      case 'not-found: dev-env': return 'spilt-tea-006'
      case 'not-found: pantry': return 'spilt-tea-007'
      case 'not-found: arg': return 'spilt-tea-008'
      case 'parser: pantry: package.yml': return 'spilt-tea-102'
      case '#helpwanted': return 'spilt-tea-411'
      case 'http': return 'spilt-tea-500'
    default: {
      const exhaustiveness_check: never = this.id
      throw new Error(`unhandled id: ${exhaustiveness_check}`)
    }}
  }

  title() {
    switch (this.id) {
    case 'not-found: pantry: package.yml':
      return `not found in pantry: ${this.ctx.project}`
    default:
      return this.id
    }
  }

  constructor(id: ID, ctx: PlainObject) {
    let msg = ''
    switch (id) {
    case 'not-found: tea -X: arg0':
      msg = undent`
        couldn’t find a pkg to provide: \`${ctx.arg0}'

            https://github.com/teaxyz/pantry.zero#contributing

        `
        break
    case 'not-found: exe/md: region':
      msg = `markdown section for \`${ctx.script}\` has no \`\`\`sh code block`
      break
    case 'not-found: exe/md: default target':
      if (ctx.requirementsFile) {
        msg = `markdown section \`# Getting Started\` not found in \`${ctx.requirementsFile}\``
      } else {
        msg = undent`
          no \`README.md\` or \`package.json\` found.
          `
      }
      break
    case 'not-found: pantry':
      if (ctx.path) {
        msg = `no pantry at path: ${ctx.path}, try \`tea --sync\``
      } else {
        msg = 'no pantry: run `tea --sync`'
      }
      break
    case 'http':
      msg = ctx.cause?.message ?? "unknown HTTP error"
      break
    case 'not-found: pantry: package.yml':
      msg = "    https://github.com/teaxyz/pantry.zero#contributing\n"
      break
    case 'parser: pantry: package.yml':
      msg = undent`
        pantry entry invalid. please report this bug!

            https://github.com/teaxyz/pantry.core/issues/new

        ----------------------------------------------------->> attachment begin
        ${ctx.project}: ${ctx.cause?.message}
        <<------------------------------------------------------- attachment end
        `
      break
    case 'not-found: dev-env':
      msg = undent`
        \`${ctx.cwd}\` is not a developer environment.

        a developer environment requires the presence of a file or directory
        that uniquely identifies package requirements, eg. \`package.json\`.
        `
    break
    case 'not-found: arg':
      msg = undent`
       \`${ctx.arg}\` isn't a valid flag.

       see: \`tea --help\`
       `
      break
    case '#helpwanted':
      msg = ctx.details
      break
    case 'not-found: pkg.version':
      msg = undent`
        we haven’t packaged this version. but we will… *if* you open a ticket:

            https://github.com/teaxyz/pantry.core/issues/new
        `
      break
    default: {
      const exhaustiveness_check: never = id
      throw new Error(`unhandled id: ${exhaustiveness_check}`)
    }}

    const opts: ErrorOptions = {cause: ctx.cause}

    super(msg, opts)
    this.id = id ?? msg
    this.ctx = ctx
  }
}

export class UsageError extends Error
{}

export { panic } from "./safe-utils.ts"

export const wrap = <T extends Array<unknown>, U>(fn: (...args: T) => U, id: ID) => {
  return (...args: T): U => {
    try {
      let foo = fn(...args)
      if (foo instanceof Promise) {
        foo = foo.catch(converter) as U
      }
      return foo
    } catch (cause) {
      converter(cause)
    }

    function converter(cause: unknown): never {
      if (cause instanceof TeaError) {
        throw cause
      } else {
        throw new TeaError(id, {...args, cause})
      }
    }
  }
}
