# FAQ

## How do I run the latest version of `tea`?

* either `brew upgrade tea`
* or `tea@latest`

Depending on how you installed `tea` originally


## How do I run the latest version of a specific pkg?

Unless otherwise instructed, `tea` executes the latest version of pkgs that
*are installed*. The first time you run a pkg the latest version will be
installed, but after that updates will only be fetched if requested.

```sh
tea deno@latest
```

> If you install tea/gui we can have it automatically install updates.


## How do I install pkgs?

To make pkgs available to the wider system use
[`tea commit`](tea-commit.md).

{% hint style="info" %}
You can update committed pkgs by `tea use pkg@latest && tea commit`
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
$ tea node^20.1.3 --version
v20.1.5
```

Which will match node v20.1.3 up to but not including v21.


## What does `+pkg` syntax do?

`+pkg` syntax is a way to include additional pkgs in your environment.
Typing `tea +deno` dumps the environment to the terminal, if you add
additional commands then those commands are invoked in that environment.


## How do I list what packages are cached?

Coming soon.

For now, all packages are encapsulated in individual, versioned folders in
`~/.tea` just like `brew`.


## A pkg I was expecting is not available

Open source is ever moving and somebody needs to keep up with it.
You may need to contribute to the [pantry](pantry.md).


## Where do you put pkgs?

Everything goes in `~/.tea`. eg. Deno v1.2.3 installs an independent POSIX
prefix to `~/.tea/deno.land/v1.2.3`, thus the `deno` executable is at
`~/.tea/deno.land/v1.2.3/bin/deno`.

We also install symlinks for majors, minors and latest:

```sh
$ cd ~/.tea/deno.land
$ ls -la
v*   -> v1.2.3
v1   -> v1.2.3
v1.2 -> v1.2.3
```

Open source is vast and unregulated, thus we use fully-qualified naming scheme
to ensure pkgs can be disambiguated.


## Can I bundle `~/.tea` into my distributable app?

Yes! Our pkgs are relocatable.


## Will you support other platforms?

We would love to support all platforms. All that is holding is back from new
platforms is expertise. Will you help? Let’s talk [discussions].


## How do I add my package to tea?

Eventually we will support describing how to build or obtain distributables
for your package via your repo so you can just add a `tea.yaml` and users
can use tea to use your package automatically.

For now see our section on the [pantry](pantry.md).


## How should I recommend people install my pkg with tea?

```sh
$ tea your-package --args
```

You can also recommend our shell one-liner if you like:

```sh
sh <(curl tea.xyz) +your-package sh
```

Will for example install tea and your pkg then open a new shell with it
available to the environment.


## What happened to “tea Magic”?

We removed “magic” from tea at v1 because it had a number of unsolvable
issues. If you want it back however fortunately the shellcode is simple:

```sh
function command_not_found_handle {
  tea -- "$*"
}
```


## How do I uninstall `tea`?

```sh
tea uninstall tea
```

This will uninstall tea, all package caches and deintegrate your
`~/.shellrc` files as well.


{% hint style="warning" %}

### Caveats

Though not a problem unique to `tea` you should note that tools installed
with `tea` may have polluted your system during use. Check directories like:

* `~/.local`
* `~/.gem`
* `~/.npm`
* `~/.node`
* etc.

{% endhint %}


## I have another question

[Support](support.md)
