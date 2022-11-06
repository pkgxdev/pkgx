import { PlainObject } from "is_what"
import { undent } from "utils"

type ID =
  'not-found: tea -X: arg0' |
  'not-found: exe/md: default target' |
  'http'

export default class TeaError extends Error {
  id: ID
  ctx: PlainObject

  code() {
    switch (this.id) {
      case 'not-found: tea -X: arg0': return 'spilt-tea-001'
      case 'not-found: exe/md: default target': return 'spilt-tea-002'
      case 'http': return 'spilt-tea-404'
    default: {
      const exhaustiveness_check: never = this.id
      throw new Error(`unhandled id: ${exhaustiveness_check}`)
    }}
  }

  constructor(id: ID, ctx: PlainObject) {
    let msg = ''
    switch (id) {
    case 'not-found: tea -X: arg0':
      msg = undent`
        couldn’t find a pkg to provide: \`${ctx.arg0}'

        open a pull-request to add it to the pantry:

            https://github.com/teaxyz/pantry.extra
        `
        break
    case 'not-found: exe/md: default target':
      msg = undent`
        default target not found:

            ${ctx.requirementsFile}
        `
        break
    case 'http':
      msg = ctx.underr?.message ?? "contact violated"
      break
    default: {
      const exhaustiveness_check: never = id
      throw new Error(`unhandled id: ${exhaustiveness_check}`)
    }}
    super(msg)
    this.id = id ?? msg
    this.ctx = ctx
  }
}

export class UsageError extends Error
{}

export function panic(message?: string): never {
  throw new Error(message)
}

export const wrap = <T extends Array<unknown>, U>(fn: (...args: T) => U, id: ID) => {
  return (...args: T): U => {
    try {
      let foo = fn(...args)
      if (foo instanceof Promise) {
        foo = foo.catch(converter) as U
      }
      return foo
    } catch (underr) {
      converter(underr)
    }

    function converter(underr: unknown): never {
      if (underr instanceof TeaError) {
        throw underr
      } else {
        throw new TeaError(id, {...args, underr})
      }
    }
  }
}
