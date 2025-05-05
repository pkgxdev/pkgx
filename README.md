![pkgx.dev](https://pkgx.dev/banner.png)

`pkgx` is a 4 MiB, standalone binary that can _run anything_.

[![coverage][]][coveralls] [![teaRank][]](https://tea.xyz)

> [!NOTE]
>
> You want your tools to _just work_ and we want that too. We pride ourselves
> on packaging things as well as possible because we want you to change the
> world with what you build and not have to worry about the rest.

&nbsp;

### Quickstart

```sh
brew install pkgx || curl https://pkgx.sh | sh
```

```pwsh
# Windows 10+
irm https://pkgx.sh | iex
# ^^ we only have limited packages so far
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

## Run _Any Version_ of Anything

```sh
$ pkgx node@14 --version
Node.js v14.21.3

$ pkgx python@2 --version
Python 2.7.18
```

## Run Anywhere

<details><summary>macOS</summary><br>

- macOS >= 11
- 64 bit Intel & Apple Silicon

</details>
<details><summary>Linux</summary><br>

- glibc >=2.28 [repology](https://repology.org/project/glibc/versions)
- libgcc
- `x86_64` & `arm64`

> Specifically these libs are needed:
>
> - libatomic.so.1 (provided by libgcc)
> - libdl.so.2 (provided by glibc)
> - libm.so.6 (provided by glibc)
> - libgcc_s.so.1 (provided by libgcc)
> - libpthread.so.0 (provided by glibc)
> - libc.so.6 (this _is_ glibc)
> - ld-linux-x86-64.so.2 (provided by the kernel, you get this for free)
>
> `libgcc` is built as part of the GCC distribution and usually is split out
> into multiple packages by the linux distribution. `libgcc` is almost always
> a separate package, but you may need to install `gcc` in its entirety.
> Sometimes libatomic is also a separate package rather than being part of
> `gcc` or `libgcc`.

</details>
<details><summary>Windows</summary><br>

- Experimental Windows native support (limited packages)
- WSL2 (everything Linux supports)

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
- uses: pkgxdev/setup@v4
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
automatically determine and utilize your dependencies based on your project’s
keyfiles.

```sh
$ cd myproj

myproj $ dev
+cargo +rust

myproj $ code .
```

</details>

## What Can `pkgx` Run?

We have a web based package listing at
[pkgx.dev/pkgs](https://pkgx.dev/pkgs/).

From the CLI you can use query mode:

```sh
$ pkgx -Q git
# ^^ can you run git? (outputs the fully qualified project name)

$ pkgx -Q
# ^^ list everything that could be run

$ pkgx -Q | grep git-
# ^^ what git extensions does pkgx provide?
```

&nbsp;

# The `pkgx` Ecosystem

`pkgx` is not just a package runner, it’s a composable primitive that can be
used to build a whole ecosystem of tools.

## `dev`

`dev` uses `pkgx` and shellcode to create “virtual environments” consisting of
the specific versions of tools and their dependencies you need for your
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

Above you can see how we “loaded” the shebang with `+pkg` syntax to bring in all
the tools we needed.

> We have pretty advanced versions of the above script, eg
> [teaBASE][teaBASE-release-script]

There’s tools for just about every language ecosystem so you can import
dependencies. For example, here we use `uv` to run a python script with pypi
dependencies, and pkgx to load both `uv` and a specific python version:

```sh
#!/usr/bin/env -S pkgx +python@3.11 uv run

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
> We love scripting with `pkgx` so much that we made a whole package manager for
> scripts to show the world what is possible when the whole open source
> ecosystem is available to your scripts Check it out [`mash`].

> [!NOTE]
>
> Notably, packages used during your script aren’t installed and don’t pollute
> your system and anyone else’s systems either. Don’t be confused— they are
> downloaded to `~/.pkgx` but the wider system is not touched.

## `pkgo` (Package…GO!)

Some Open Source resists packaging and instead includes long installation
instructions that can be… tedious. [`pkgo`] makes using amazing tools like
[“Stable Diffusion WebUI”] as easy as typing `pkgo` (thanks to `pkgx`).

## Recursive Run

Easily run tools from other language ecosystems:

```sh
pkgx uvx cowsay "Run Python (PyPi) programs with `uvx`"  # or pipx
pkgx bunx cowsay "Run JavaScript (NPM) programs tools with `bunx`"  # or `npx`
```

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

We now provide [`pkgm`][pkgm] which fully installs `pkgx` packages to
`/usr/local/`.

If you miss the leanness of pkgx^1 “shims then use `pkgm shim`.

```sh
$ pkgm shim git
created shim: ~/.local/bin/git

$ cat ~/.local/bin/git
#!/usr/bin/env -S pkgx -q! git
```

&nbsp;

# Contributing

We recommend using [`dev`] to make rust available.

- To add packages see the [pantry README]
- To hack on `pkgx` itself; clone it and `cargo build`
  - [`hydrate.rs`] is where optimization efforts will bear most fruit

## Pre-PR Linting

```sh
cargo fmt --all --check
cargo clippy --all-features
pkgx npx markdownlint --config .github/markdownlint.yml --fix .
```

&nbsp;

# Chat / Support / Questions

We love a good chinwag.

- [Discord](https://discord.gg/rNwNUY83XS)
- [github.com/orgs/pkgxdev/discussions][discussions]

[docs]: https://docs.pkgx.sh
[pantry README]: ../../../pantry#contributing
[discussions]: ../../discussions
[docs.pkgx.sh/scripts]: https://docs.pkgx.sh/scripts
[docs.pkgx.sh/installing-w/out-brew]: https://docs.pkgx.sh/installing-w/out-brew
[dev]: https://github.com/pkgxdev/dev
[pkgm]: https://github.com/pkgxdev/pkgm
[teaBASE-release-script]: https://github.com/teaxyz/teaBASE/blob/main/Scripts/publish-release.sh
[`hydrate.rs`]: crates/lib/src/hydrate.rs
[`mash`]: https://github.com/pkgxdev/mash
[`dev`]: https://github.com/pkgxdev/dev
[`pkgo`]: https://github.com/pkgxdev/pkgo
[“Stable Diffusion WebUI”]: https://github.com/AUTOMATIC1111/stable-diffusion-webui
[coverage]: https://coveralls.io/repos/github/pkgxdev/pkgx/badge.svg?branch=main
[coveralls]: https://coveralls.io/github/pkgxdev/pkgx?branch=main
[teaRank]: https://img.shields.io/endpoint?url=https%3A%2F%2Fchai.tea.xyz%2Fv1%2FgetTeaRankBadge%3FprojectId%3D79e9363b-862c-43e0-841d-4d4eaad1fc95
