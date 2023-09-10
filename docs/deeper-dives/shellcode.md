# `tea` Shellcode

The `tea` shellcode is not integrated by default, first study the shellcode
by dumping to your terminal:

```sh
tea --shellcode
```

As you can see the shellcode is a handful of shell functions to achieve the
following:

* a handler for `tea +pkg`
  * our handler uses tea primitives to install and inject the requested pkgs
    into the shell session
* a command not found handler
  * to suggest `tea` invocations for commands we support
* Some `_` support prefixed functions for the above
* We add `~/.local/bin` to your `PATH`
  * we configure packages that install things themselves to install things there

* a change directory hook so developer environments can be activated and
  deactivated automatically when you change directories


## Integrating the Shellcode

First dry run the integration:

```sh
tea integrate --dry-run
```

Then integrate:

```sh
tea integrate
```


## Deintegrating the Shellcode

If at any point you want to deintegrate the `tea` shellcode type:

```sh
tea deintegrate
```



# Dive Deeper

[Shellcode Mechanics and User Manual](shellcode.md)
