# `pkgx`

`pkgx` is a 4 MiB, standalone binary that can _run anything_.

## Quick Start

```sh
brew install pkgx || curl https://pkgx.sh | sh
```

```pwsh
irm https://pkgx.sh | iex  # Windows
```

{% hint style='info' %}
[Installation Guide](installing-pkgx.md)
{% endhint %}

## Using `pkgx`

- [Run Anything](pkgx.md)
- [Scripting](scripting.md)

# The `pkgx` Ecosystem

`pkgx` is more than a package runner, it’s a composable primitive that can be
used to build a whole ecosystem of tools. Here’s what we’ve built so far:

## `dev`

`dev` uses shellcode and `pkgx` to create “virtual environments” for any project
and any toolset.

{% hint style='info' %}
[https://github.com/pkgxdev/dev](https://github.com/pkgxdev/dev)
{% endhint %}

## `pkgm`

`pkgm` installs `pkgx` packages to `/usr/local`.

{% hint style='info' %}
[https://github.com/pkgxdev/pkgm](https://github.com/pkgxdev/pkgm)
{% endhint %}

## `mash`

`mash` is a package manager for scripts that use `pkgx` to make the whole open
source ecosystem available to them.

{% hint style='info' %}
[https://github.com/pkgxdev/mash](https://github.com/pkgxdev/mash)
{% endhint %}

## `pkgo` (Package…GO!)

Some Open Source resists packaging and instead includes long installation
instructions that can be… tedious. `pkgo` makes using amazing tools like
[“Stable Diffusion WebUI”] as easy as typing `pkgo` (thanks to `pkgx`).

{% hint style='info' %}
[https://github.com/pkgxdev/pkgo](https://github.com/pkgxdev/pkgo)
{% endhint %}

[“Stable Diffusion WebUI”]: https://github.com/AUTOMATIC1111/stable-diffusion-webui

# Support

[Discord](https://discord.gg/rNwNUY83XS)
