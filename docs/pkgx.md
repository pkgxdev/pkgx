# Using `pkgx`

With `pkgx` it couldn’t be simpler to run anything from the Open Source
ecosystem:

```sh
$ pkgx openai --version
openai 1.59.6
```

## Search

Generally you don’t need to search since you already know what you want to
run, so just type it! Sometimes though you want to browse.

We have a web based package listing at
[pkgx.dev/pkgs/](https://pkgx.dev/pkgs/). This is the most thorough resource
at this time.

And from the CLI you can use query mode:

```sh
$ pkgx -Q git
# ^^ can we run git?

$ pkgx -Q | grep git-
# ^^ search for all git extensions

$ $ pkgx -Q
# ^^ list every program pkgx can run
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
`pkgx mash upgrade foo`.

## Adding Additional Packages to the Execution Environment

It can be useful to run a program with additional packages in the environment.

```sh
pkgx +openssl cargo build
```

Here `+pkg` syntax added OpenSSL to Cargo’s environment. Thus the build will see
the OpenSSL headers and libraries.

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

In general it's a good idea to specify fully qualified names in scripts, etc.
since you want these to work forever.

## Running System Commands

It can be useful to run system commands with a package environment injected. To
do this either specify the full path of the system executable:

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

## Quietening Output

````sh
$ pkgx --quiet gum format 'download progress is still shown'
# ^^ supresses resolving/syncing etc. messages but not download progress info
# `pkgx -q` is the same

```sh
pkgx --silent gum format 'no output at all'
# ^^ silences everything, even errors
# ^^ `pkgx -qq` is the same
````

Note that this only effects `pkgx` _not the tools you run with `pkgx`_.

## Ensuring Packages

In some cases you don’t want to use a `pkgx` package if the user has that
package already installed to their system. For these cases we provide an
`ensure` script:

```sh
$ pkgx mash ensure git --version
# ^^ runs system `git` if installed, otherwise installs the `pkgx` pkg

$ eval "$(pkgx mash ensure +git)"
# ^^ adds pkgx git to the environment *unless* it is installed to the system
```

## “Virtual Environments”

You can set `PKGX_DIR` to have `pkgx` install packages there. This can be useful
for creating “virtual environments” for various usages.

```sh
$ export PKGX_DIR="$PWD/foo"  # must be an absolute path or is ignored

$ pkgx +gum
$ find foo
foo/charm.sh/gum/v0.14.5/bin/gum

$ eval "$(pkgx +gum)"
$ echo $PATH
$PWD/foo/charm.sh/gum/v0.14.5/bin/gum:…
```

## Other Common Needs

`pkgx` is not a package manager. Thus the command itself doesn’t typically offer
such operations you may expect, however the way `pkgx` works is simple and
standardized so we offer some `mash` scripts to help.

Longer term we will make a tool `pkgq` to help with these operations.

### Upgrading Packages

`pkgx foo` executes the latest version of `foo` that is _downloaded_. To ensure
you have (any) newer versions installed use this command:

```sh
$ pkgx mash upgrade
updating: /Users/mxcl/.pkgx/python.org/v3.11.11
# snip…
```

### Pruning Older Versions of Packages

The `pkgx` download cache can get large over time. To prune older versions:

```sh
$ pkgx mash prune
pruning: ~/.pkgx/deno.land/v1.39.4
pruning: ~/.pkgx/deno.land/v1.46.3
# snip…
```

This may delete versions that you use—if so—this is fine. `pkgx` will just
reinstall them next time you need them.

### Listing Available Versions for a Package

ie. what versions _could be_ run by `pkgx`:

```sh
$ pkgx mash inventory git
2.38.1
2.39.0
# snip…
```

### Listing What is Downloaded

```sh
$ pkgx mash ls

  Parent Directory                │Version
  ────────────────────────────────┼──────────
  perl.org                        │5.40.0
  x.org/xcb                       │1.17.0
  # snip…
```

[SemVer]: https://devhints.io/semver
