# `tea` & Docker

We provide an image based on Debian Buster (slim) preloaded with `tea`:

```sh
$ docker run -it teaxyz/cli
$ tea +node@16
$ npm start
```

You can use this as a base:

```Dockerfile
FROM teaxyz/cli
RUN tea +node@16
RUN npm start
```

Or if you want to use `tea` in another image:

```Dockerfile
FROM archlinux
RUN eval "$(curl -Ssf --proto '=https' https://tea.xyz)"
RUN tea +node@16
RUN npm start
```

`eval`ing our one-liner also integrates `tea` with the container’s shell.
If you don’t want that you can `curl -Ssf tea.xyz | sh` instead.


{% hint style="success" %}
We have binaries for Linux aarch64 (arm64) thus Docker on your Apple Silicon
Mac is as fast and easy as deployments.
{% endhint %}
