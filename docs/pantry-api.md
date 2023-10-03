# The `pkgx` API

Visit [dist.pkgx.dev](https://dist.pkgx.dev) for an HTTP index.

* sources (mirror)
  * `dist.pkgx.dev/<PKG>/versions.txt`
  * `dist.pkgx.dev/<PKG>/v<VERSION>.tar.gz`
  * `dist.pkgx.dev/<PKG>/v<VERSION>.sha256sum`
* bottles
  * `dist.pkgx.dev/<PKG>/<PLATFORM>/<ARCH>/versions.txt`
  * `dist.pkgx.dev/<PKG>/<PLATFORM>/<ARCH>/v<VERSION>.tar.gz`
  * `dist.pkgx.dev/<PKG>/<PLATFORM>/<ARCH>/v<VERSION>.tar.xz`
  * `dist.pkgx.dev/<PKG>/<PLATFORM>/<ARCH>/v<VERSION>.asc`
  * `dist.pkgx.dev/<PKG>/<PLATFORM>/<ARCH>/v<VERSION>.sha256sum`

`versions.txt` files are newline separated, sorted lists of available versions
for each type of distributable.

{% hint style="warning" %}
`dist.pkgx.dev/<PKG>/versions.txt` and the bottle `versions.txt` may not be
the same. Always check the more specific `versions.txt`.
{% endhint %}


## The Pantry

The [pantry] is our API for pkg metadata.


## libpkgx

We build the cli and the gui on top of [libpkgx]. You may find it useful to
add pkging powers to your apps.

[pantry]: https://github.com/pkgxdev/pantry
[libpkgx]: https://github.com/pkgxdev/libpkgx
