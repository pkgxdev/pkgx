# `tea` & Scripting

## shebangs

You can use `tea` as the [shebang] for your scripts:

```python
#!/usr/bin/env -S tea python@3.9

import sys

print(sys.version)
```

```sh
$ chmod +x ./my-script.py
$ ./my-script.py
3.9.17
```

{% hint style="info" %}
Using `env` to invoke `tea` is typical for tools that have no POSIX location.

The `-S` parameter is required to pass multiple arguments.
{% endhint %}


### Including Additional pkgs

Scripts are the glue that allows open source to be composed into powerful new
tools. With our `+pkg` syntax you make anything in open source available to
your your script.

```sh
#!/usr/bin/env -S tea +openssl deno run

Deno.dlopen("libssl.dylib")
```

## Shell Scripting

```sh
#!/bin/sh

eval "$(tea --shellcode)"
# ^^ integrates `tea` during this script execution

tea +openai-python
# ^^ requires integration

openai --version
```

Robustness requires precisely specifying your environment:

```sh
#!/usr/bin/env -S tea bash>=4

source <(tea --shellcode)
# ^^ bash >=4 is required for this syntax, and eg macOS only comes with bash 3
```

{% hint style="info" %}

### Super Portable Scripts

If you like you can use our cURL-installer in your scripts. If `tea` is
installed then the script just exits and uses that `tea`, if it’s not
installed, it installs tea to a **temporary directory** first.

```sh
#!/bin/sh

eval "$(curl -Ssf https://tea.xyz)"

which tea   #=> /tmp/tea.xyz/tea
echo $PATH  #=> /tmp/tea.xyz:$PATH

tea +node@16 which node  #=> /tmp/tea.xyz/nodejs.org/v16/bin/node
```

{% endhint %}


[shebang]: https://en.wikipedia.org/wiki/Shebang_(Unix)
