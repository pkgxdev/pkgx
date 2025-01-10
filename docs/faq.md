# FAQ

## How do I run the latest version of `pkgx`?

Typically you want to upgrade `pkgx` so either:

1. `brew upgrade pkgx`; or
2. `curl -LSsf pkgx.sh | sh`

> [!NOTE]
> Yes. Our installer upgrades `pkgx` too.


## How do I run the latest version of a specific pkg?

Unless otherwise instructed, `pkgx` executes the latest version of packages
that *are downloaded*. The first time you run a package the latest version
will be downloaded, but after that updates will only be fetched if requested
or required by other packages.

For us neophiliacs we have written a [`mash`] script to upgrade your `pkgx`
packages:

```sh
pkgx mash pkgx/cache upgrade
```


## How do I “install” pkgs?

Use [`pkgm`](https://github.com/pkgxdev/pkgm).


## What is a package?

A package is:

* A plain tarball containing a single project for a single platform and
  architecture compiled from that project’s sources
* A bundle of metadata (`package.yml`) from the [pantry]

Relative to some other packaging systems:

* No scripts are executed post “install”
* Packages must work from any location (we say our pkgs are “relocatable“)


## A package version I need is unavailable

Sorry about that. Open a [ticket] asking for it and we’ll build it.

[ticket]: https://github.com/pkgxdev/pantry/issues/new


## I need a pkg greater than v20.1.3 but less than v21

The commonly used `@` syntax would evaluate to v20.1.x (`@20.1.3`).

To provide more control we support the
[full semantic version range syntax](https://devhints.io/semver). So for the
given example we would use the caret (`^`):

```sh
$ pkgx node^20.1.3 --version
v20.1.5
```

Which will match node v20.1.3 up to but not including v21.


## What does `+pkg` syntax do?

`+pkg` syntax is a way to include additional pkgs in your environment.
Typing `pkgx +deno` dumps the environment to the terminal, if you add
additional commands then those commands are invoked in that environment.


## How do I list what packages are downloaded?

We have created a [`mash`] script to list everything `pkgx` has downloaded:

```sh
pkgx mash pkgx/cache ls
```

All packages are encapsulated in individual, versioned folders in
`~/.pkgx` just like `brew` so you can just browse them with a file browser.


## A pkg I was expecting is not available

Open source is ever moving and somebody needs to keep up with it.
You may need to contribute to the [pantry](pantry.md).


## Where do you put pkgs?

Everything goes in `~/.pkgx`. eg. Deno v1.2.3 is an independent POSIX
prefix at `~/.pkgx/deno.land/v1.2.3`, thus the `deno` executable is at
`~/.pkgx/deno.land/v1.2.3/bin/deno`.

We also create symlinks for majors, minors and latest:

```sh
$ cd ~/.pkgx/deno.land
$ ls -la
v*   -> v1.2.3
v1   -> v1.2.3
v1.2 -> v1.2.3
```

Open source is vast and unregulated, thus we use fully-qualified naming scheme
to ensure pkgs can be disambiguated.


## Can I bundle `~/.pkgx` into my distributable app?

Yes! Our pkgs are relocatable.


## Will you support other platforms?

We would love to support all platforms. All that is holding is back from new
platforms is expertise. Will you help? [Let’s talk].

[Let’s talk]: https://github.com/pkgxdev/pkgx/issues/607


## How do I add my package to pkgx?

You need to add to the [pantry](pantry.md).

{% hint style="info" %}
Eventually we will support describing how to build or obtain distributables
for your package via your repo so you can just add a `pkgx.yaml` and users
can use pkgx to use your package automatically.
{% endhint %}


## How should I recommend people use my pkg with pkgx?

```sh
pkgx your-package --args
```

You can also recommend our shell one-liner if you like:

```sh
sh <(curl https://pkgx.sh) your-package --args
```

This is neat because `pkgx` is *not installed* and it runs your package from a
temporary location making this a very low friction way to try out your
package.

Finally, you can have them try your package out via our Docker image:

```sh
docker run pkgxdev/pkgx your-package --args
```

## How do I uninstall `pkgx`?

```sh
sudo rm /usr/local/bin/pkg[xm]
rm -rf ~/.pkgx
```

Then there are a couple platform specific cache/data directories:

### macOS

```sh
rm -rf ~/Library/Caches/pkgx
rm -rf ~/Application\ Support/pkgx
```

### Non macOS

```sh
rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/pkgx"
rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}"/pkgx
```

{% hint style="warning" %}

### Caveats

Though not a problem unique to `pkgx` you should note that tools run
with `pkgx` may have polluted your system during use. Check directories like:

* `~/.local`
* `~/.gem`
* `~/.npm`
* `~/.node`
* etc.

{% endhint %}


## What are the rules for `@` syntax?

The rules for `@` are complex, but more human. We convert them to the
following [semver] syntax:

* `@3` → `^3`
* `@3.1` → `~3.1`
* `@3.1.2` → `>=3.1.2<3.1.3`
* `@3.1.2.3` → `>=3.1.2.3<3.1.3.4`
* etc.

[semver]: https://devhints.io/semver


## Where does `pkgx` store files

* pkgs are downloaded to `~/.pkgx` (`$PKGX_DIR` overrides)
* runtime data like the [pantry] is stored in:
  * `~/Library/Caches/pkgx` on Mac
  * `${XDG_CACHE_HOME:-$HOME/.cache}/pkgx` on *nix
  * `%LOCALAPPDATA%/pkgx` on Windows


## What happens if two packages provide the same named program?

We error with a method to disambiguation, eg:

```sh
$ yarn
× multiple projects provide: yarn
│ pls be more specific:
│
│     pkgx +classic.yarnpkg.com --internal.use +yarn
│     pkgx +yarnpkg.com --internal.use +yarn
│
╰─➤ https://docs.pkgx.sh/help/ambiguous-pkgspec
```


## How do I see a man page for a pkgx pkg?

`man foo` won’t work since pkgx pkgs are not “installed”. Thus you have to
first create an environment that contains that package before invoking `man`:

```sh
pkgx +foo man foo
```

This uses pkgx’s `man` tool. To use the system `man`:

```sh
pkgx +foo -- man foo
```


## I have another question

[Support](support.md)


[`mash`](https://mash/pkgx.sh)
