import { plumbing } from "pkgx"
const { which } = plumbing

export default async function(args: string[]) {
  const pp = args.map(arg => which(arg, { all: true, providers: true }))
  const rv = await Promise.all(pp)
  return rv.flatMap(wut => wut.map(({ project }) => project))
}
