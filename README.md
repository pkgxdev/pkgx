![pkgx.dev](https://pkgx.dev/banner.png)

`pkgx` is a single, *standalone binary* that can *run anything*.
&nbsp;&nbsp;[![coverage][]][coveralls]

&nbsp;


### Quickstart

```sh
brew install pkgxdev/made/pkgx
```

> * [docs.pkgx.sh/installing-w/out-brew]
> * [Migrating from v0](https://blog.pkgx.dev/pkgx-1-0-0-alpha-1/)

&nbsp;


# Run Anything

```sh
$ deno
command not found: deno

$ pkgx deno
Deno 1.36.3
> ^D

$ deno
command not found: deno
# ^^ nothing was installed; your system remains untouched
```


## Run *Any Version* of Anything

```sh
$ pkgx node@14 --version
Node.js v14.21.3

$ pkgx python@2 --version
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
  $ pkgx docker run -it pkgxdev/pkgx

  (docker) $ pkgx node@16
  Welcome to Node.js v16.20.1.
  Type ".help" for more information.
  >
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

  > [docs.pkgx.sh/docker]

  </details>
* <details><summary>CI/CD</summary><br>

  ```yaml
  - uses: pkgxdev/setup@v1
  - run: pkgx shellcheck
  ```

  Or in other CI/CD providers:

  ```sh
  $ curl https://pkgx.sh | sh
  $ pkgx shellcheck
  ```

  > [docs.pkgx.sh/ci-cd]

  </details>
* <details><summary>Scripts</summary><br>

  ```sh
  #!/usr/bin/env -S pkgx +git python@3.12

  # python 3.12 runs the script and `git` is available during its execution
  ```

  > [docs.pkgx.sh/scripts]

  </details>
* <details><summary>Editors</summary><br>

  ```sh
  $ cd myproj

  myproj $ env +cargo
  (+cargo) myproj $ code .
  ```

  Or use [`dev`][dev]; a separate tool that uses the pkgx primitives to
  automatically determine and utilize your dependencies based on your
  project’s keyfiles.

  ```sh
  $ cd myproj

  myproj $ dev
  env +cargo +rust

  (+cargo+rust) my-rust-project $ code .
  ```

  > [docs.pkgx.sh/editors]

  </details>

&nbsp;


# Shell Integration

`pkgx` puts the whole open source ecosystem at your fingertips and its
***optional*** shell integration makes workflows with that open source
even more seamless.

```sh
$ env +go@1.16    # do `pkgx integrate --dry-run` first
added ~/.pkgx/go.dev/v1.16 to environment

(+go) $ go
Go is a tool for managing Go source code.
#…

(+go) $ env | grep go
PATH=~/.pkgx/go.dev/v1.16.15/bin:$PATH
LIBRARY_PATH=~/.pkgx/go.dev/v1.16.15/lib

(+go) $ env -go
removed ~/.pkgx/go.dev/v1.16 from environment

$ go
command not found: go
```

Tools are available for the duration of your terminal session.
If you need them for longer, eg. `pkgx install go`.

> [docs.pkgx.sh/shell-integration] \
> [docs.pkgx.sh/pkgx-install]

## `dev`

`dev` is a separate tool that leverages pkgx's core
features to auto-detect and install project dependencies, seamlessly
integrating them into your shell and editor.

```sh
my-rust-proj $ dev    # do `pkgx integrate --dry-run` first
dev: found Cargo.toml; env +cargo +rust

(+cargo+rust) my-rust-proj $ cargo build
Compiling my-rust-proj v0.1.0
#…
```

The `dev` tool requires our shell integration to work.

> [docs.pkgx.sh/dev][dev]

&nbsp;



# Getting Started

```sh
brew install pkgxdev/made/pkgx
```

> no `brew`? [docs.pkgx.sh/installing-w/out-brew]

### Integrating with your Shell

```sh
pkgx integrate --dry-run   # docs.pkgx.sh/shell-integration
```

## Further Reading

[docs.pkgx.sh][docs] is a comprehensive manual and user guide for `pkgx`.

&nbsp;



# Contributing

* To add packages see the [pantry README]
* To hack on `pkgx` itself; clone it and then `pkgx deno task` to list
  entrypoints for hackers

If you have questions or feedback:

* [github.com/orgs/pkgxdev/discussions][discussions]
* [x.com/pkgxdev](https://x.com/pkgxdev) (DMs are open)


[docs]: https://docs.pkgx.sh
[pantry README]: ../../../pantry#contributing
[discussions]: ../../discussions
[docs.pkgx.sh/pkgx-install]: https://docs.pkgx.sh/pkgx-install
[docs.pkgx.sh/ci-cd]: https://docs.pkgx.sh/ci-cd
[docs.pkgx.sh/scripts]: https://docs.pkgx.sh/scripts
[docs.pkgx.sh/editors]: https://docs.pkgx.sh/editors
[docs.pkgx.sh/docker]: https://docs.pkgx.sh/docker
[docs.pkgx.sh/installing-w/out-brew]: https://docs.pkgx.sh/installing-w/out-brew
[docs.pkgx.sh/shell-integration]: https://docs.pkgx.sh/shell-integration
[dev]: https://docs.pkgx.sh/dev

[coverage]: https://coveralls.io/repos/github/pkgxdev/pkgx/badge.svg?branch=main
[coveralls]: https://coveralls.io/github/pkgxdev/pkgx?branch=main
