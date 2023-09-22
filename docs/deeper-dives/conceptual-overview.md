# Appendix

## How `pkgx` Works: A Conceptual Overview

Everything `pkgx` does involves initially creating package environment. It then
either runs commands inside those environments or injects those environments
into your running shell.

A command like:

```sh
pkgx node start
```

Is in fact implicitly:

```sh
pkgx +node node start
```

Which more precisely† is in fact:

```sh
pkgx +nodejs.org node start
```

> † see [disambiguation](pkgx-cmd.md#disambiguation)

The `+pkg` syntax creates the package environment that `node start` is then
run within.

In fact you can see that env if you invoke `pkgx` raw:

```sh
$ pkgx +node
SSL_CERT_FILE=~/.pkgx/curl.se/ca-certs/v2023.5.30/ssl/cert.pem
PATH=~/.pkgx/unicode.org/v71.1.0/bin:~/.pkgx/unicode.org/v71.1.0/sbin:~/.pkgx/openssl.org/v1.1.1u/bin:~/.pkgx/nodejs.org/v20.5.0/bin
MANPATH=~/.pkgx/unicode.org/v71.1.0/share/man:~/.pkgx/zlib.net/v1.2.13/share/man:~/.pkgx/nodejs.org/v20.5.0/share/man:/usr/share/man
PKG_CONFIG_PATH=~/.pkgx/unicode.org/v71.1.0/lib/pkgconfig:~/.pkgx/openssl.org/v1.1.1u/lib/pkgconfig:~/.pkgx/zlib.net/v1.2.13/lib/pkgconfig
LIBRARY_PATH=~/.pkgx/unicode.org/v71.1.0/lib:~/.pkgx/openssl.org/v1.1.1u/lib:~/.pkgx/zlib.net/v1.2.13/lib
LD_LIBRARY_PATH=~/.pkgx/unicode.org/v71.1.0/lib:~/.pkgx/openssl.org/v1.1.1u/lib:~/.pkgx/zlib.net/v1.2.13/lib
CPATH=~/.pkgx/unicode.org/v71.1.0/include:~/.pkgx/openssl.org/v1.1.1u/include:~/.pkgx/zlib.net/v1.2.13/include:~/.pkgx/nodejs.org/v20.5.0/include
XDG_DATA_DIRS=~/.pkgx/unicode.org/v71.1.0/share:~/.pkgx/zlib.net/v1.2.13/share:~/.pkgx/nodejs.org/v20.5.0/share
DYLD_FALLBACK_LIBRARY_PATH=~/.pkgx/unicode.org/v71.1.0/lib:~/.pkgx/openssl.org/v1.1.1u/lib:~/.pkgx/zlib.net/v1.2.13/lib
```

This is a composable primitive, and is used by our [shellcode](shellcode.md),
eg. `env +node` is basically just:

```sh
$ eval "$(pkgx +node)"

$ node --version
Node.js v20.5.0
```

And thus you could imagine `pkgx npm start` to be:

```sh
env "$(pkgx +node)" npm start
```
