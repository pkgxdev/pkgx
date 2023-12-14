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


## `dev`

`dev` works in our image but because Docker steps are each individual shells
our shellcode only works in that step. Thus:

```Dockerfile
FROM pkgxdev/pkgx
RUN dev && npm start
```

To use `dev` in another image is more complicated but there are a couple
options:

```Dockerfile
FROM ubuntu

# Install curl in case it isn't already
RUN apt update && apt upgrade && apt install curl

RUN eval "$(curl https://pkgx.sh)" && dev && npm start
```

{% hint style="info" %}
`eval`ing our installer integrates the shell code into the current shell.
{% endhint %}

Alternatively you can use `pkgx integrate` provided docker is instructed to
use a more advanced shell like bash:

```Dockerfile
FROM ubuntu

SHELL ["/bin/bash", "-c"]

# Install curl in case it isn't already
RUN apt update && apt upgrade && apt install curl

RUN curl https://pkgx.sh | sh
RUN pkgx integrate
RUN dev && npm start  # you still have to run `dev && ` tho
```

---

{% hint style="info" %}

[https://hub.docker.com/r/pkgxdev/pkgx](https://hub.docker.com/r/pkgxdev/pkgx)

{% endhint %}
