# `pkgx` & CI/CD

## GitHub Actions

```sh
- uses: pkgxdev/setup@v1
- run: pkgx go@1.20 build
```

Installs `pkgx` so you can then run `go build` with go version ^1.20.

```sh
- uses: pkgxdev/setup@v1
  with:
    +: node@16
- run: node --version
```

`node` v16 will be available in your job.

### `dev`

```sh
- uses: actions/checkout@v3
- uses: pkgxdev/dev@v1
```

The developer environment for your project will be available during the job.

## Other CI/CD Providers

```sh
eval "$(curl https://pkgx.sh)"
```

`pkgx` will be installed and integrated. Use as per general terminal
guidelines, eg:

```sh
env +node@16 && npm start
```

{% hint style="info" %}
`pkgx` can make it easy to use the GNU or BSD versions of core utilities
across platforms.

```sh
pkgx +gnu.org/coreutils ls
```

{% endhint %}
