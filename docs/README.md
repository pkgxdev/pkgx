# `pkgx`

`pkgx` is a 4 MiB, standalone binary that can *run anything*.

## Quick Start

```sh
brew install pkgx || curl https://pkgx.sh | sh
```

{% hint style='info' %}
[Installation Guide](installing-pkgx.md)
{% endhint %}

## Using `pkgx`

| <p>​<a href="running-anything.md">Run Anything</a><br>Run anything with `pkgx`</p> | <p><a href="scripting.md">Scripting</a><br>Write scripts in any language with all the tools you need available from L:1</p> |
| ----- | ----- |

# The `pkgx` Ecosystem

`pkgx` is more than a package runner, it’s a composable primitive that can be
used to build a whole ecosystem of tools. Here’s what we’ve built so far:

## `dev`

`dev` uses shellcode and `pkgx` to create “virtual environments” for any
project and any toolset.

{% hint style='info' %}
[https://github.com/pkgxdev/dev](https://github.com/pkgxdev/dev)
{% endhint %}

## `pkgm`

`pkgm` installs `pkgx` packages to `/usr/local`.

{% hint style='info' %}
[https://github.com/pkgxdev/pkgm](https://github.com/pkgxdev/pkgm)
{% endhint %}

## `mash`

`mash` is a package manager for scripts that use `pkgx` to make the whole
open source ecosystem available to them.

{% hint style='info' %}
[https://github.com/pkgxdev/mash](https://github.com/pkgxdev/mash)
{% endhint %}
