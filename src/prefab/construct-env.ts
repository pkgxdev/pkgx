import { Installation, Package, hooks, utils } from "pkgx"
const { usePantry } = hooks
const { host } = utils

export default async function(pkgenv: { installations: Installation[] }) {
  const rv = await mkenv({...pkgenv})

  // don’t break `man` lol
  //TODO don’t add if already there obv
  if (rv["MANPATH"]) {
    rv["MANPATH"] = `${rv["MANPATH"]}:/usr/share/man`
  }

  // makes libraries precise rather than having them use their rpaths
  //FIXME SIP on macOS prevents DYLD_FALLBACK_LIBRARY_PATH from propagating to grandchild processes
  if (rv.LIBRARY_PATH) {
    rv.LD_LIBRARY_PATH = rv.LIBRARY_PATH.replace('$LIBRARY_PATH', '${LD_LIBRARY_PATH}')
    if (host().platform == 'darwin') {
      // non FALLBACK variety causes strange issues in edge cases
      // where our symbols somehow override symbols from the macOS system
      rv.DYLD_FALLBACK_LIBRARY_PATH = rv.LIBRARY_PATH.replace('$LIBRARY_PATH', '${DYLD_FALLBACK_LIBRARY_PATH}')
    }
  }

  for (const key in rv) {
    rv[key] = rv[key].replaceAll(new RegExp(`\\$${key}\\b`, 'g'), `\${${key}}`)
    // don’t end with a trailing `:` since that is sometimes interpreted as CWD and can break things
    // instead of `foo:${PATH}` we end up with `foo${PATH:+:PATH}` which is not POSIX but works
    // with all the shells that we support shellcode for and avoids a trailing `:`
    // NOTE this may not work with FISH though.
    rv[key] = rv[key].replaceAll(new RegExp(`:+\\$\{${key}}$`, 'g'), `\${${key}:+:$${key}}`)
  }

  return rv
}

///////////////////////// reworked from useShellEnv needs porting back to libpkgx
async function mkenv({installations}: {installations: Installation[]}) {
  const projects = new Set(installations.map(x => x.pkg.project))
  console.assert(projects.size == installations.length, "pkgx: env is being duped")

  const common_vars: Record<string, OrderedSet<string>> = {}
  const common_keys = new Set<string>()

  for (const { path } of installations) {

    const test = (part: string, key: string) => {
      const d = path.join(part).isDirectory()
      if (!d) return
      if (!common_vars[key]) common_vars[key] = new OrderedSet()
      common_vars[key].add(d.string)
      common_keys.add(key)
    }

    test("bin", 'PATH')
    test("include", 'CPATH')
    test("lib", 'LIBRARY_PATH')
    test('lib/pkgconfig', 'PKG_CONFIG_PATH')
    test("man", "MANPATH")
    test("sbin", 'PATH')
    test('share', 'XDG_DATA_DIRS')
    test("share/man", "MANPATH")
    test('share/pkgconfig', 'PKG_CONFIG_PATH')

    if (projects.has('cmake.org')) {
      test('', 'CMAKE_PREFIX_PATH')
    }

    if (projects.has('gnu.org/autoconf')) {
      test("share/aclocal", 'ACLOCAL_PATH')
    }
  }

  const rv: Record<string, string> = {}

  for (const { pkg } of installations) {
    const runtime_env = await _internals.runtime_env(pkg, installations)
    for (const key in runtime_env) {
      const value = runtime_env[key]

      if (common_keys.has(key)) {
        // if the package has specific env for a key we handle ourselves we treat it differently

        const new_set = new OrderedSet<string>()
        let superkey_present = false
        for (const part of value.split(":")) {
          if (part == `$${key}`) {
            common_vars[key].toArray().forEach(x => new_set.add(x))
            superkey_present = true
          } else {
            new_set.add(part)
          }
        }
        // we don’t care if the package author didn’t include the superkey
        // we are not going to throw away all the other env lol!
        if (!superkey_present) {
          new_set.add_all(common_vars[key])
        }

        common_vars[key] = new_set

      } else {
        const rx = new RegExp(`(\\$${key})(\\b)`, 'g')
        if (rx.test(value)) {
          if (rv[key]) {
            // replace eg. `foo:$FOO:bar` with `foo:${existing}:$FOO:bar`
            rv[key] = value.replaceAll(rx, (_, a, b) => `${b}${rv[key]}${b}${a}`)
          } else {
            rv[key] = value
          }
        } else {
          //NOTE this means we may replace user-specified env
          //TODO show warning!
          rv[key] = value
        }
      }
    }
  }

  for (const key of common_keys) {
    if (!common_vars[key].isEmpty()) {
      rv[key] = [...common_vars[key].toArray(), `$${key}`].join(':')
    }
  }

  return rv
}

////////////////////////////////////////////////////////////////////////// utils
class OrderedSet<T> {
  private items: T[];
  private set: Set<T>;

  constructor(items: T[] = []) {
    this.items = items;
    this.set = new Set();
  }

  add(item: T): void {
    if (!this.set.has(item)) {
      this.items.push(item);
      this.set.add(item);
    }
  }

  add_all(items: OrderedSet<T>) {
    for (const item of items.items) {
      this.add(item)
    }
  }

  toArray(): T[] {
    return [...this.items];
  }

  isEmpty(): boolean {
    return this.items.length == 0
  }
}

////////////////////////////////////////////////////////////////////// internals
export const _internals = {
  runtime_env: (pkg: Package, installations: Installation[]) => usePantry().project(pkg.project).runtime.env(pkg.version, installations)
}
