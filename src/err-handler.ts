import { DownloadError, InstallationNotFoundError, PantryError, PantryParseError, ResolveError, TeaError, utils } from "tea"
import { AmbiguityError, ProgrammerError, ProvidesError } from "./utils/error.ts"
import announce from "./utils/announce.ts";

export default function(err: Error) {
  if (err instanceof InstallationNotFoundError) {
    const subtitle = utils.pkg.str(err.pkg)
    render("not cached", subtitle, [], 'pkg-not-cached')
  } else if (err instanceof DownloadError) {
    render("download failure", `${err.status}`, [
      ['there was an issue fetching %s', err.src.toString()]
    ], 'http-failure')
  } else if (err instanceof ResolveError) {
    render('version unavailable', utils.pkg.str(err.pkg), [
      ['please check the following url for available versions']
    ], `https://tea.xyz/+${err.pkg.project}`)
  } else if (err instanceof PantryParseError) {
    //TODO well not if it's a custom edit tho
    render('parse error', err.project, [
      ['this is a serious issue. please report the bug']
    ], `https://github.com/teaxyz/cli/issues/new?title=parse+issue+${err.project}`)
  } else if (err instanceof PantryError) {
    render('pantry error', err.message, [[JSON.stringify(err.ctx)]], 'pantry-error')
  } else if (err instanceof AmbiguityError) {
    const args = Deno.args.join(' ')
    const projects = err.projects.map(p => [`   %c tea +${p} ${args} %c`, 'background-color: black; color: white', 'color: initial'])
    render('multiple projects provide:', err.arg0, [
        ['pls be more specific:'],
        [], ...projects, []
      ]
    , 'ambiguous-pkgspec')
  } else if (err instanceof ProvidesError) {
    render('nothing provides:', err.arg0, [
      ['we haven’t pkgd this yet. %ccan you?', 'font-weight: bold']
    ], 'https://docs.tea.xyz/pantry')
  } else if (err instanceof ProgrammerError) {
    render('programmer error', undefined, [['this is a bug, please report it']], 'https://github.com/teaxyz/cli/issues/new')
  } else if (err instanceof TeaError) {
    console.error('%c × %s', 'color: red', err.message)
  } else {
    const title = 'unexpected error'
    const ctx = err.stack?.split('\n').map(x => [x]) ?? [['no stack trace']]
    render(title, err.message, ctx, 'https://github.com/teaxyz/cli/issues/new')
  }
  return 1
}

export function render(title: string, subtitle: string | undefined, body: (string[])[], help: string | undefined) {
  announce({ title, subtitle, body, help, color: 'red' })
}
