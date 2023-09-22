# `pkgx` as part of a C/C++ Pipeline

We have most of the most popular c & c++ libraries pkg’d so just add them
to your developer environment.

```yaml
# pkgx.yaml

dependencies:
  openssl.org: ^3
  github.com/gabime/spdlog: ^1
  llvm.org: ^14
  gnu.org/autoconf: ^2
  cmake.org: ^3
```

Usually this is enough to have tools like Autoconf or CMake find the libraries
sometimes though you may need to provide a helping hand. Examine the devenv
with `pkgx` for path information.

Then `dev` to activate the environment.
