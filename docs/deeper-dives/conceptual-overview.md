# Appendix

## How `tea` Works: A Conceptual Overview

Everything `tea` does involves initially creating package environment. It then
either runs commands inside those environments or injects those environments
into your running shell.

A command like:

```sh
tea node start
```

Is in fact implicitly:

```sh
tea +node node start
```

Which more precisely† is in fact:

```sh
tea +nodejs.org node start
```

> † see [disambiguation](tea-cmd.md#disambiguation)

The `+pkg` syntax creates the package environment that `node start` is then
run within.

In fact you can see that env if you invoke `tea` raw:

```sh
$ command tea +node
SSL_CERT_FILE=~/.tea/curl.se/ca-certs/v2023.5.30/ssl/cert.pem
PATH=~/.tea/unicode.org/v71.1.0/bin:~/.tea/unicode.org/v71.1.0/sbin:~/.tea/openssl.org/v1.1.1u/bin:~/.tea/nodejs.org/v20.5.0/bin
MANPATH=~/.tea/unicode.org/v71.1.0/share/man:~/.tea/zlib.net/v1.2.13/share/man:~/.tea/nodejs.org/v20.5.0/share/man:/usr/share/man
PKG_CONFIG_PATH=~/.tea/unicode.org/v71.1.0/lib/pkgconfig:~/.tea/openssl.org/v1.1.1u/lib/pkgconfig:~/.tea/zlib.net/v1.2.13/lib/pkgconfig
LIBRARY_PATH=~/.tea/unicode.org/v71.1.0/lib:~/.tea/openssl.org/v1.1.1u/lib:~/.tea/zlib.net/v1.2.13/lib
LD_LIBRARY_PATH=~/.tea/unicode.org/v71.1.0/lib:~/.tea/openssl.org/v1.1.1u/lib:~/.tea/zlib.net/v1.2.13/lib
CPATH=~/.tea/unicode.org/v71.1.0/include:~/.tea/openssl.org/v1.1.1u/include:~/.tea/zlib.net/v1.2.13/include:~/.tea/nodejs.org/v20.5.0/include
XDG_DATA_DIRS=~/.tea/unicode.org/v71.1.0/share:~/.tea/zlib.net/v1.2.13/share:~/.tea/nodejs.org/v20.5.0/share
DYLD_FALLBACK_LIBRARY_PATH=~/.tea/unicode.org/v71.1.0/lib:~/.tea/openssl.org/v1.1.1u/lib:~/.tea/zlib.net/v1.2.13/lib
```

This is a composable primitive, and is used by our [shellcode](shellcode.md),
eg. `pkg +node` basically just:

```sh
$ source <(tea +node)

$ node --version
Node.js v20.5.0
```

And thus you could imagine `tea npm start` to be:

```sh
env "$(tea +node)" npm start
```
