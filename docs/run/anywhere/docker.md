# `pkgx` & Docker

We provide an image based on Debian Buster (slim) preloaded with `pkgx`:

```sh
$ docker run -it pkgxdev/pkgx
docker $ env +node@16
docker $ npm start
```

You can use this as a base:

```Dockerfile
FROM pkgxdev/pkgx
RUN pkgx +node@16 npm start
```

Or if you want to use `pkgx` in another image:

```Dockerfile
FROM archlinux
RUN curl -Ssf --proto '=https' https://pkgx.sh | sh
RUN pkgx +node@16 npm start
```

{% hint style="success" %}
We have binaries for Linux aarch64 (arm64) thus Docker on your Apple Silicon
Mac is as fast and easy as deployments.
{% endhint %}

{% hint style="warning" %}
At this time our shellcode doesn’t work in Docker, but we are working on
making `pkgx` able to be a proxy shell for these situations.
{% endhint %}
