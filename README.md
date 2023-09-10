![tea](https://tea.xyz/banner.png)

`tea` is a single, *standalone binary* that can *run anything*.
&nbsp;&nbsp;[![coverage][]][coveralls]
[![release-badge][](../../releases)

&nbsp;


### Quickstart

```sh
brew install teaxyz/pkgs/tea-cli
```

> * [docs.tea.xyz/installing-w/out-brew]
> * [Migrating from tea v0](https://slack-files.com/T02MTUY60NS-F05NRQ8CT51-a881910f74)

&nbsp;


# Run Anything

```sh
$ deno
command not found: deno

$ tea deno
Deno 1.36.3
> ^D

$ deno
command not found: deno
# ^^ nothing was installed; your system remains untouched
```


## Run *Any Version* of Anything

```sh
$ tea node@14 --version
Node.js v14.21.3

$ tea python@2 --version
Python 2.7.18
```


## Run Anywhere

* <details><summary>macOS</summary><br>

  * macOS >= 11
  * x86-64 & Apple Silicon

  </details>
* <details><summary>Linux</summary><br>

  * glibc >=2.28 [repology](https://repology.org/project/glibc/versions)
  * `x86_64` & `arm64`

  </details>
* <details><summary>Windows</summary><br>

  WSL2; x86-64. *Native windows is planned.*

  </details>
* <details><summary>Docker</summary><br>

  ```sh
  $ tea docker run -it teaxyz/cli

  (docker) $ tea node@16
  Welcome to Node.js v16.20.1.
  Type ".help" for more information.
  >
  ```

  Or in a `Dockerfile`:

  ```Dockerfile
  FROM teaxyz/cli
  RUN tea deno@1.35 task start
  ```

  Or in any image:

  ```Dockerfile
  FROM ubuntu
  RUN curl https://tea.xyz | sh
  RUN tea python@3.10 -m http.server 8000
  ```

  > [docs.tea.xyz/docker]

  </details>
* <details><summary>CI/CD</summary><br>

  ```yaml
  - uses: teaxyz/setup@v0
  - run: tea shellcheck
  ```

  Or in other CI/CD providers:

  ```sh
  $ curl https://tea.xyz | sh
  $ tea shellcheck
  ```

  > [docs.tea.xyz/ci-cd]

  </details>
* <details><summary>Shebangs</summary><br>

  ```sh
  #!/usr/bin/env -S tea python@3.10
  ```

  > [docs.tea.xyz/scripts]

  </details>
* <details><summary>Editors</summary><br>

  ```sh
  $ cd myproj

  myproj $ tea use cargo
  (+cargo) myproj $ code .
  ```

  Or use [`dev`][dev]; a separate tool that uses tea primitives to
  automatically determine and utilize your dependencies based on your
  project’s keyfiles.

  ```sh
  $ cd myproj

  myproj $ dev
  ^^ type `tea` to run that

  myproj $ tea
  tea +dev && dev
  dev: found cargo.toml; adding ~/.tea/cargo/v* to environment

  (+cargo+rust) my-rust-project $ code .
  ```

  > [docs.tea.xyz/editors]

  </details>

&nbsp;


# Shell Integration

`tea` puts the whole open source ecosystem at your fingertips and its
***optional*** shell integration makes workflows with that open source
even more seamless.

```sh
$ tea +go@1.16
added ~/.tea/go.dev/v1.16 to environment

(+go) $ go
Go is a tool for managing Go source code.
#…

(+go) $ env | grep go
PATH=~/.tea/go.dev/v1.16.15/bin:$PATH
LIBRARY_PATH=~/.tea/go.dev/v1.16.15/lib

(+go) $ tea -go
removed ~/.tea/go.dev/v1.16 from environment

$ go
command not found: go
```

Tools are available for the duration of your terminal session.
If you need them for longer, `tea install`.

> [docs.tea.xyz/shell-integration] \
> [docs.tea.xyz/tea-install]

## `dev`

`dev` is a separate tool that leverages tea's core
features to auto-detect and install project dependencies, seamlessly
integrating them into your shell and editor.

```sh
my-rust-proj $ dev
dev: found cargo.toml; tea +cargo

(+cargo+rust) my-rust-proj $ cargo build
Compiling my-rust-proj v0.1.0
#…
```

> [docs.tea.xyz/dev][dev]

&nbsp;



# Getting Started

```sh
brew install teaxyz/pkgs/tea-cli
```

> no `brew`? [docs.tea.xyz/installing-w/out-brew]

### Integrating with your Shell

```sh
tea integrate --dry-run   # docs.tea.xyz/shell-integration
```

## Further Reading

[docs.tea.xyz][docs] is a comprehensive manual and user guide for `tea`.

&nbsp;



# Contributing

* To add packages see the [pantry README]
* To hack on `tea` itself; clone it and then `tea deno task` to list
  entrypoints for hackers

If you have questions or feedback:

* [github.com/orgs/teaxyz/discussions][discussions]
* [x.com/teaxyz](https://x.com/teaxyz) (DMs are open)


[docs]: https://docs.tea.xyz
[pantry README]: ../../../pantry#contributing
[discussions]: ../../discussions
[docs.tea.xyz/tea-install]: https://docs.tea.xyz/tea-install
[docs.tea.xyz/ci-cd]: https://docs.tea.xyz/ci-cd
[docs.tea.xyz/scripts]: https://docs.tea.xyz/scripts
[docs.tea.xyz/editors]: https://docs.tea.xyz/editors
[docs.tea.xyz/docker]: https://docs.tea.xyz/docker
[docs.tea.xyz/installing-w/out-brew]: https://docs.tea.xyz/installing-w/out-brew
[docs.tea.xyz/shell-integration]: https://docs.tea.xyz/shell-integration
[dev]: https://docs.tea.xyz/dev

[coverage]: https://coveralls.io/repos/github/teaxyz/cli/badge.svg?branch=main
[coveralls]: https://coveralls.io/github/teaxyz/cli?branch=main

[release-badge]: https://img.shields.io/github/downloads-pre/teaxyz/cli/latest/total
