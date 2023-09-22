import { dim } from './color.ts'

export default function({ title, subtitle, body, help, color }: {title: string, subtitle?: string | undefined, body: (string[])[], help?: string | undefined, color?: string}) {
  color = `color: ${color ?? '#5f5fff'}`
  help ??= 'unknown-error'

  if (subtitle) {
    console.error('%c× %s %c%s', color, title, 'color: initial', subtitle)
  } else {
    console.error('%c× %s', color, title)
  }
  for (const [s1, ...ss] of body) {
    console.error(`%c│%c ${s1 ?? ''}`, color, 'color: initial', ...ss)
  }

  const url = help.startsWith('http') ? help : `https://docs.pkgx.sh/help/${help}`
  console.error('%c╰─➤%c %s', color, 'color: initial', dim(url))
}
