export default function(x: string) {
  /// `$` because we add some env vars recursively
  if (!/\s/.test(x) && !/['"$><]/.test(x)) return x
  if (!x.includes('"')) return `"${x}"`
  if (!x.includes("'")) return `'${x}'`
  x = x.replaceAll('"', '\\"')
  return `"${x}"`
}
