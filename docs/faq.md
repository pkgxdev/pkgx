# FAQ

## How do I run the latest version of `pkgx`?

pkgx is just another pkg so:

```sh
pkgx@latest npx@latest cowsay@latest 'fancy a cuppa?'
```

Is a valid command, provided you have shell integration.

If you are looking to upgrade the “installed” `pkgx` version then use
`brew upgrade pkgx`, re-run the installer (it upgrades itself) or repeat
your installation method.

A self-upgrade feature is coming soon.


## How do I run the latest version of a specific pkg?

Unless otherwise instructed, `pkgx` executes the latest version of pkgs that
*are cached*. The first time you run a pkg the latest version will be
cached, but after that updates will only be fetched if requested.

```sh
pkgx deno@latest
```

> [OSS.app](https://pkgx.app) can automatically install updates.


## How do I “install” pkgs?

To make pkgs available to the wider system use
[`pkgx install`](pkgx-install.md).

{% hint style="info" %}
You can update installed packages with `pkgx install foo@latest`
{% endhint %}


## What is a package?

A package is:

* A plain tarball containing a single project for a single platform and
  architecture compiled from that project’s sources
* A bundle of metadata (`package.yml`) from the [pantry]

Relative to some other packaging systems:

* No scripts are executed post install
* Packages must work as is from any location provided their deps are installed
  in parallel (we say our pkgs are “relocatable“)


## A package version I need is unavailable

Sorry about that. Open a [ticket] asking for it and we’ll build it.

[ticket]: https://github.com/pkgxdev/pantry/issues/new


## I need to pin a pkg to greater than v20.1.3 but less than v21

The commonly used `@` syntax would pin the pkg to v20.1.x (`@20.1.3`).

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


## How do I list what packages are cached?

Coming soon.

For now, all packages are encapsulated in individual, versioned folders in
`~/.pkgx` just like `brew`.


## A pkg I was expecting is not available

Open source is ever moving and somebody needs to keep up with it.
You may need to contribute to the [pantry](pantry.md).


## Where do you put pkgs?

Everything goes in `~/.pkgx`. eg. Deno v1.2.3 installs an independent POSIX
prefix to `~/.pkgx/deno.land/v1.2.3`, thus the `deno` executable is at
`~/.pkgx/deno.land/v1.2.3/bin/deno`.

We also install symlinks for majors, minors and latest:

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


## How should I recommend people install my pkg with pkgx?

```sh
$ pkgx your-package --args
```

You can also recommend our shell one-liner if you like:

```sh
sh <(curl https://pkgx.sh) +your-package sh
```

Will for example install pkgx and your pkg then open a new shell with it
available to the environment.


## What happened to ”Magic”?

We removed “magic” from pkgx at v1 because it had a number of unsolvable
issues. If you want it back however fortunately the shellcode is simple:

```bash
function command_not_found_handle {
  pkgx -- "$*"
}
# NOTE in zsh append an `r` ie `command_not_found_handler``
```


## I added a package to the pantry but `pkgx foo` fails

Try `pkgx --sync foo` to force a pantry sync. Typically this isn’t needed but
this flag can help in confusing situations.


## How do I uninstall `pkgx`?

For now `rm -rf ~/.pkgx` is enough.

*Coming Soon*.

```sh
pkgx uninstall pkgx
```

{% hint style="warning" %}

### Caveats

Though not a problem unique to `pkgx` you should note that tools installed
with `pkgx` may have polluted your system during use. Check directories like:

* `~/.local`
* `~/.gem`
* `~/.npm`
* `~/.node`
* etc.

{% endhint %}


## I have another question

[Support](support.md)
