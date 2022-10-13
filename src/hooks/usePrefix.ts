import Path from "path"

const prefix = (() => {
  //NOTE doesn't work for scripts as Deno.run doesn't push through most env :/
  const env = Deno.env.get("TEA_PREFIX")
  if (env) {
    return new Path(env)
  } else {
    // we’re either deno.land/vx/bin/deno, tea.xyz/vx/bin/tea or some symlink to the latter
    const shelf = new Path(Deno.execPath())
      .readlink() // resolves the leaf symlink (if any)
      .parent()
      .parent()
      .parent()

    switch (shelf.basename()) {
    case 'tea.xyz':
    case 'deno.land':
      return shelf.parent()
    default:
      // we’re being generous for users who just download `tea` by itself
      // and execute it without installing it in a sanctioned structure
      return Path.home().join(".tea")
    }
  }
})()

class Prefix extends Path {
  www: Path

  constructor(prefix: Path) {
    super(prefix)
    this.www = prefix.join("tea.xyz/var/www")
  }
}

export default function usePrefix() {
  return new Prefix(prefix)
}
