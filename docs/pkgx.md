# Run Anything

With `pkgx` it couldn’t be simpler to run anything from the Open Source
ecosystem:

```sh
$ pkgx openai --version
openai 1.59.6
```

## Run Any Version

```sh
$ pkgx postgres@12 --version
postgres (PostgreSQL) 12.14
```

{% hint style="info" %}

### SemVer

Generally you probably want `@` syntax, but if you need more specificity we
fully support [SemVer]:

```sh
$ pkgx postgres^12 --version
postgres (PostgreSQL) 12.14

$ pkgx "postgres>=12<14" --version
postgres (PostgreSQL) 13.11

$ pkgx deno=1.35.3 --version
deno 1.35.3
```

{% endhint %}

### Running the Latest Version

`pkgx foo` runs the latest “foo” that **is installed**.

If you want to ensure the latest version of “foo” is installed, use
`pkgx mash pkgx/upgrade foo`.


## Adding Additional Packages to the Execution Environment

It can be useful to run a program with additional packages in the environment.

```sh
pkgx +openssl cargo build
```

Here `+pkg` syntax added OpenSSL to Cargo’s environment. Thus the build will
see the OpenSSL headers and libraries.


## Disambiguation

In some cases `pkgx foo` may be ambiguous because multiple packages provide
`foo`.

In such cases `pkgx` will error and ask you be more specific by using
fully-qualified-names:

```sh
$ pkgx yarn --version
error: multiple projects provide `yarn`. please be more specific:

    pkgx +classic.yarnpkg.com yarn --version
    pkgx +yarnpkg.com yarn --version
```

In general it's a good idea to specify fully qualified names in
scripts, etc. since you want these to work forever.


## Running System Commands

It can be useful to run system commands with a package environment injected.
To do this either specify the full path of the system executable:

```sh
pkgx +llvm.org /usr/bin/make
```

Or separate your commands with `--`:

```sh
pkgx +llvm.org -- make  # finds `make` in PATH, failing if none found
```

{% hint style="warning" %}

If you only specified `make` rather than `/usr/bin/make` or separating with
`-- make` then `pkgx` would install GNU make for you and use that.

{% endhint %}


## Dumping the Environment

If you don’t specify anything to run, `pkgx` will install any `+pkg`s and then
dump the environment:

```sh
$ pkgx +gum
PATH="$HOME/.pkgx/charm.sh/gum/v0.14.5/bin${PATH:+:$PATH}"
```

This can be useful in scripts or for adding tools to your shell:

```sh
$ eval "$(pkgx +gum)"
$ gum --version
gum version 0.14.5
```

For this mode we can also output JSON: `pkgx +gum --json`.


## Silent Mode

```sh
pkgx --silent gum format 'no progress information is output'
```

[SemVer]: https://devhints.io/semver
