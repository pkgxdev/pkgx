![pkgx.dev](https://pkgx.dev/banner.png)

`pkgx` is a 4 MiB, standalone binary that can *run anything*.

[![coverage][]][coveralls] [![teaRank][]](https://tea.xyz)

&nbsp;


### Quickstart

```sh
brew install pkgx || curl https://pkgx.sh | sh
```

> [docs.pkgx.sh/installing-w/out-brew]

&nbsp;


# Run Anything

```sh
$ deno
command not found: deno

$ pkgx deno
Deno 2.1.4
> ^D

$ deno
command not found: deno
# ^^ nothing was installed; your wider system is untouched
```


## Run *Any Version* of Anything

```sh
$ pkgx node@14 --version
Node.js v14.21.3

$ pkgx python@2 --version
Python 2.7.18
```


## Run Anywhere

<details><summary>macOS</summary><br>

* macOS >= 11
* 64 bit Intel & Apple Silicon

</details>
<details><summary>Linux</summary><br>

* glibc >=2.28 [repology](https://repology.org/project/glibc/versions)
* `x86_64` & `arm64`

</details>
<details><summary>Windows</summary><br>

WSL2; x86-64. *Native windows is planned.*

</details>
<details><summary>Docker</summary><br>

We provide an image with `pkgx` in it:

```sh
$ pkgx docker run -it pkgxdev/pkgx

(docker) $ pkgx node@16
Welcome to Node.js v16.20.1.
Type ".help" for more information.
>
```

You can use this image to try out (pretty much) any version of any program:

```sh
$ docker run pkgxdev/pkgx node@21.1 --version
v21.1.0
```

Or in a `Dockerfile`:

```Dockerfile
FROM pkgxdev/pkgx
RUN pkgx deno@1.35 task start
```

Or in any image:

```Dockerfile
FROM ubuntu
RUN curl https://pkgx.sh | sh
RUN pkgx python@3.10 -m http.server 8000
```

</details>
<details><summary>CI/CD</summary><br>

```yaml
- uses: pkgxdev/setup@v3
- run: pkgx shellcheck
```

Or in other CI/CD providers:

```sh
curl https://pkgx.sh | sh
pkgx shellcheck
```

</details>
<details><summary>Scripts</summary><br>

```sh
#!/usr/bin/env -S pkgx +git python@3.12

# python 3.12 runs the script and `git` is available during its execution
```

> [docs.pkgx.sh/scripts]

</details>
<details><summary>Editors</summary><br>

Use [`dev`][dev]; a separate tool that uses the pkgx primitives to
automatically determine and utilize your dependencies based on your
project’s keyfiles.

```sh
$ cd myproj

myproj $ dev
+cargo +rust

myproj $ code .
```

</details>

&nbsp;


# The `pkgx` Ecosystem

`pkgx` is not just a package runner, it’s a composable primitive that can be
used to build a whole ecosystem of tools.

## `dev`

`dev` uses `pkgx` and shellcode to create “virtual environments” consisting
of the specific versions of tools and their dependencies you need for your
projects.

```sh
$ cd my-rust-proj && ls
Cargo.toml  src/

my-rust-proj $ cargo build
command not found: cargo

my-rust-proj $ dev
+rust +cargo

my-rust-proj $ cargo build
Compiling my-rust-proj v0.1.0
#…
```

> [github.com/pkgxdev/dev][dev]


## `pkgm`

`pkgm` installs `pkgx` packages to `/usr/local`. It installs alongside `pkgx`.

> [github.com/pkgxdev/pkgm][pkgm]


## Scripting

A powerful use of `pkgx` is scripting, eg. here’s a script to release new
versions to GitHub:

```sh
#!/usr/bin/env -S pkgx +gum +gh +npx +git bash>=4 -eo pipefail

gum format "# determining new version"

versions="$(git tag | grep '^v[0-9]\+\.[0-9]\+\.[0-9]\+')"
v_latest="$(npx -- semver --include-prerelease $versions | tail -n1)"
v_new=$(npx -- semver bump $v_latest --increment $1)

gum format "# releasing v$v_new"

gh release create \
  $v_new \
  --title "$v_new Released 🎉" \
  --generate-notes \
  --notes-start-tag=v$v_latest
```

Above you can see how we “loaded” the shebang with `+pkg` syntax to bring in
all the tools we needed.

> We have pretty advanced versions of the above script, eg
> [teaBASE][teaBASE-release-script]

There’s tools for just about every language ecosystem so you can import
dependencies. For example, here we use `uv` to run a python script with
pypi dependencies, and pkgx to load both `uv` and a specific python version:

```sh
#!/usr/bin/env -S pkgx +python@3.11 uv run --script

# /// script
# dependencies = [
#   "requests<3",
#   "rich",
# ]
# ///

import requests
from rich.pretty import pprint

resp = requests.get("https://peps.python.org/api/peps.json")
data = resp.json()
pprint([(k, v["title"]) for k, v in data.items()][:10])
```

> [!TIP]
>
> ### Mash
>
> We love scripting with `pkgx` so much that we made a whole package manager
> for scripts to show the world what is possible when the whole open source
> ecosystem is available to your scripts Check it out [`mash`].

> [!NOTE]
>
> Notably, packages used during your script aren’t installed and don’t pollute
> your system and anyone else’s systems either. Don’t be confused— they are
> downloaded to `~/.pkgx` but the wider system is not touched.

## Recursive Run

Easily run tools from other language ecosystems:

```sh
pkgx uvx cowsay "Run Python (PyPi) programs with `uvx`"  # or pipx
pkgx bunx cowsay "Run JavaScript (NPM) programs tools with `bunx`"  # or `npx`
```

## Magic

It can be fun to add magic to your shell:

```sh
# add to ~/.zshrc
command_not_found_handler() {
  pkgx -- "$@"
}
```

Thus if you type `gh` and it’s not installed pkgx will magically run it as
though it was installed all along.

> [!NOTE]
> Bash is the same function but drop the `r` from the end of the name.

&nbsp;


# Further Reading

[docs.pkgx.sh][docs] is a comprehensive manual and user guide for the `pkgx`
suite.

&nbsp;


# Migrating from `pkgx`^1

## Shellcode

The `pkgx` suite has had its scopes tightened. There is no shellcode in `pkgx`
anymore. Instead [`dev`] is its own separate tool that has its own shellcode.
Migrate your shell configuration with:

```sh
pkgx pkgx^1 deintegrate
pkgx dev integrate
```

## `env +foo`

If you used this, let us know, we can make a mash script to provide this
functionality again. You can achieve the same result as eg. `env +git` with:

```sh
eval "$(pkgx +git)"
```

Surround the `eval` with `set -a` and `set +a` if you need the environment
exported.

## `pkgx install`

We now provide [`pkgm`][pkgm] but if you miss the leanness of “stubs” we
provide a [`mash`] script to create stubs in `/usr/local/bin`:

```sh
$ pkgx mash pkgx/stub git
created stub: /usr/local/bin/git

$ cat /usr/local/bin/git
#!/bin/sh
exec pkgx git "$@"
```

&nbsp;


# Contributing

We recommend using [`dev`] to make rust available.

* To add packages see the [pantry README]
* To hack on `pkgx` itself; clone it and `cargo build`
  * [`hydrate.rs`] is where optimization efforts will bear most fruit

## Pre-PR Linting

```sh
cargo fmt --all --check
cargo clippy --all-features
pkgx npx markdownlint --config .github/markdownlint.yml --fix .
```

&nbsp;


# Chat / Support / Questions

We love a good chinwag.

* [Discord](https://discord.gg/rNwNUY83XS)
* [github.com/orgs/pkgxdev/discussions][discussions]

[docs]: https://docs.pkgx.sh
[pantry README]: ../../../pantry#contributing
[discussions]: ../../discussions
[docs.pkgx.sh/scripts]: https://docs.pkgx.sh/scripts
[docs.pkgx.sh/installing-w/out-brew]: https://docs.pkgx.sh/installing-w/out-brew
[dev]: https://github.com/pkgxdev/dev
[pkgm]: https://github.com/pkgxdev/pkgm
[teaBASE-release-script]: https://github.com/teaxyz/teaBASE/blob/main/Scripts/publish-release.sh
[`hydrate.rs`]: src/hydrate.rs
[`mash`]: https://github.com/pkgxdev/mash
[`dev`]: https://github.com/pkgxdev/dev

[coverage]: https://coveralls.io/repos/github/pkgxdev/pkgx/badge.svg?branch=main
[coveralls]: https://coveralls.io/github/pkgxdev/pkgx?branch=main
[teaRank]: https://img.shields.io/endpoint?url=https%3A%2F%2Fchai.tea.xyz%2Fv1%2FgetTeaRankBadge%3FprojectId%3D79e9363b-862c-43e0-841d-4d4eaad1fc95
