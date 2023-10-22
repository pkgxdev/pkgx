import { dim, blurple } from './color.ts'

export default function({ title, subtitle, body, help, color }: {title: string, subtitle?: string | undefined, body: (string[])[], help?: string | undefined, color?: (x: string) => string}) {
  color ??= blurple
  help ??= 'unknown-error'

  if (subtitle) {
    console.error(`${color(`× %s`)} %s`, title, subtitle)
  } else {
    console.error(color('× %s'), title)
  }
  for (const [s1, ...ss] of body) {
    console.error(`${color('│')} ${s1 ?? ''}`, ...ss)
  }

  const url = help.startsWith('http') ? help : `https://docs.pkgx.sh/help/${help}`
  console.error(`${color('╰─➤')} %s`, dim(url))
}
