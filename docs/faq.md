# FAQ

## How do I run the latest version of `pkgx`?

* either `brew upgrade pkgx`
* or `pkgx@latest`

Depending on how you installed `pkgx` originally


## How do I run the latest version of a specific pkg?

Unless otherwise instructed, `pkgx` executes the latest version of pkgs that
*are installed*. The first time you run a pkg the latest version will be
installed, but after that updates will only be fetched if requested.

```sh
pkgx deno@latest
```

> If you install pkgx/gui we can have it automatically install updates.


## How do I install pkgs?

To make pkgs available to the wider system use
[`pkgx install`](pkgx-install.md).

{% hint style="info" %}
You can update installed packages with `pkgx install foo@latest`
{% endhint %}


## What is a pkg?

A `pkg` (package) is:

* a plain tarball containing a single project for a single platform and
  architecture compiled from that project’s sources
* a bundle of metadata (`package.yml`) from the [pantry]

Relative to other pkging systems:

* no scripts are executed post install
* packages must work as is from any location provided their deps are installed
  in parallel (we say our pkgs are “relocatable“)


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
platforms is expertise. Will you help? Let’s talk [discussions].


## How do I add my package to pkgx?

Eventually we will support describing how to build or obtain distributables
for your package via your repo so you can just add a `pkgx.yaml` and users
can use pkgx to use your package automatically.

For now see our section on the [pantry](pantry.md).


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


## What happened to “pkgx Magic”?

We removed “magic” from pkgx at v1 because it had a number of unsolvable
issues. If you want it back however fortunately the shellcode is simple:

```sh
function command_not_found_handle {
  pkgx -- "$*"
}
```


## How do I uninstall `pkgx`?

Coming Soon

```sh
pkgx uninstall pkgx
```

This will uninstall pkgx, all package caches and deintegrate your
`~/.shellrc` files as well.


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
