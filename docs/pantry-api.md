# The `tea` API

Visit [dist.tea.xyz](https://dist.tea.xyz) for an HTTP index.

* sources (mirror)
  * `dist.tea.xyz/<PKG>/versions.txt`
  * `dist.tea.xyz/<PKG>/v<VERSION>.tar.gz`
  * `dist.tea.xyz/<PKG>/v<VERSION>.sha256sum`
* bottles
  * `dist.tea.xyz/<PKG>/<PLATFORM>/<ARCH>/versions.txt`
  * `dist.tea.xyz/<PKG>/<PLATFORM>/<ARCH>/v<VERSION>.tar.gz`
  * `dist.tea.xyz/<PKG>/<PLATFORM>/<ARCH>/v<VERSION>.tar.xz`
  * `dist.tea.xyz/<PKG>/<PLATFORM>/<ARCH>/v<VERSION>.asc`
  * `dist.tea.xyz/<PKG>/<PLATFORM>/<ARCH>/v<VERSION>.sha256sum`

`versions.txt` files are newline separated, sorted lists of available versions
for each type of distributable.

{% hint style="warning" %}
`dist.tea.xyz/<PKG>/versions.txt` and the bottle `versions.txt` may not be
the same. Always check the more specific `versions.txt`.
{% endhint %}


## The Pantry

The [pantry] is our API for pkg metadata.


## libtea

We build the cli and the gui on top of [libtea]. You may find it useful to add
pkging powers to your apps.


[pantry]: https://github.com/teaxyz/pantry
[libtea]: https://github.com/teaxyz/lib
