# `pkgx` & Docker

We provide an image based on Debian Buster (slim) preloaded with `pkgx`:

```sh
$ docker run -it pkgx/pkgx
docker $ env +node@16
docker $ npm start
```

You can use this as a base:

```Dockerfile
FROM pkgx/pkgx
RUN env +node@16
RUN npm start
```

Or if you want to use `pkgx` in another image:

```Dockerfile
FROM archlinux
RUN eval "$(curl -Ssf --proto '=https' https://pkgx.sh)"
RUN env +node@16
RUN npm start
```

`eval`ing our one-liner also integrates `pkgx` with the container’s shell.
If you don’t want that you can `curl -Ssf pkgx.sh | sh` instead:

```Dockerfile
FROM archlinux
RUN curl -Ssf --proto '=https' https://pkgx.sh
RUN pkgx +node@16 npm start
```


{% hint style="success" %}
We have binaries for Linux aarch64 (arm64) thus Docker on your Apple Silicon
Mac is as fast and easy as deployments.
{% endhint %}
