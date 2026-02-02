# `pkgx` & Scripting

You can use `pkgx` as the [shebang] for your scripts:

```python
#!/usr/bin/env -S pkgx python@3.9

import sys

print(sys.version)
```

```sh
$ chmod +x ./my-script.py
$ ./my-script.py
3.9.17
```

{% hint style="info" %}
Using `env` to invoke `pkgx` is typical for tools that
have no POSIX location.

The `-S` parameter is required to pass multiple arguments.
{% endhint %}

## Including Additional pkgs

Scripts are the glue that allows open source to be composed into powerful new
tools. With our `+pkg` syntax you make anything in open source available to your
script.

```sh
#!/usr/bin/env -S pkgx +openssl deno run

Deno.dlopen("libssl.dylib")
```

{% hint style="info" %}
Robustness requires precisely specifying your
environment:

```sh
#!/usr/bin/env -S pkgx bash>=4

source <(pkgx dev --shellcode)
# ^^ bash >=4 is required for this syntax, and eg macOS only comes with bash 3
```

{% endhint %}

## Scripting for Various Languages & Their Dependencies

### Python

Use `uv` to import PyPi dependencies:

```python
#!/usr/bin/env -S pkgx +python@3.11 uv run --with requests<=3 --with rich

import requests
from rich.pretty import pprint

resp = requests.get("https://peps.python.org/api/peps.json")
data = resp.json()
pprint([(k, v["title"]) for k, v in data.items()][:10])
```

### Ruby

Use [Bundler](https://bundler.io):

```ruby
#!/usr/bin/env -S pkgx ruby@3

require 'bundler/inline'

gemfile do
  source 'https://rubygems.org'
  gem 'ruby-macho', '~> 3'
end
```

### JavaScript & TypeScript

Use [Deno](https://deno.land):

```javascript
#!/usr/bin/env -S pkgx deno@2 run

import fs from "npm:fs";
```

### Rust

```rust
#!/usr/bin/env -S pkgx rust-script

//! ```cargo
//! [dependencies]
//! time = "0.1.25"
//! ```
```

> [!TIP]
> Probably you should specify a more precise Rust version as a plus-pkg arg.

### Go, C, C++, etc

Use [Scriptisto]:

```c
#!/usr/bin/env pkgx +clang +pkg-config scriptisto

#include <stdio.h>
#include <glib.h>

// scriptisto-begin
// script_src: main.c
// build_cmd: clang -O2 main.c `pkg-config --libs --cflags glib-2.0` -o ./script
// scriptisto-end

int main(int argc, char *argv[]) {
  gchar* user = g_getenv("USER");
  printf("Hello, C! Current user: %s\n", user);
  return 0;
}
```

## Mash

We think `pkgx` scripting is so powerful that we made a whole package manager to
show it off.

> [https://github.com/pkgxdev/mash](https://github.com/pkgxdev/mash)

## Other Examples

We make use of `pkgx` scripting all over our repositories. Check them out!

## Ultra Portable Scripts

Requiring a `pkgx` shebang is somewhat limiting. Instead you can use our `cURL`
one-liner coupled with `+pkg` syntax to temporarily install pkgs and utilize
them in your scripts:

```sh
#!/bin/bash

eval "$(sh <(curl https://pkgx.sh) +git)"

which git  # prints soemthing like /tmp/pkgx/git-scm.org/v2.46.3/bin/git
```

[shebang]: https://en.wikipedia.org/wiki/Shebang_(Unix)
[Scriptisto]: https://github.com/igor-petruk/scriptisto
