import { Path, Verbosity } from "types"

interface Options {
  dstdir: Path
  zipfile: Path
  verbosity: Verbosity
}

export class Unarchiver {
  protected opts: Options

  constructor(opts: Options) {
    this.opts = opts
  }

  args(): (string | Path)[] {
    return []
  }

  supports(_filename: Path): boolean {
    return false
  }
}

export class TarballUnarchiver extends Unarchiver {
  private stripComponents?: number

  constructor(opts: Options & { stripComponents?: number }) {
    super(opts)
    this.stripComponents = opts.stripComponents
  }

  args(): (string | Path)[] {
    const args = [
      "tar", "xf", this.opts.zipfile,
      "-C", this.opts.dstdir
    ]
    if (this.opts.verbosity > Verbosity.normal) args.push("--verbose")
    if (this.stripComponents) args.push(`--strip-components=${this.stripComponents}`)
    return args
  }

  static supports(filename: Path): boolean {
    switch (filename.extname()) {
    case ".tar.gz":
    case ".tar.bz2":
    case ".tar.xz":
    case ".tgz":
      return true
    default:
      return false
    }
  }
}

export class ZipUnarchiver extends Unarchiver {
  force: boolean

  constructor(opts: Options & { force?: boolean }) {
    super(opts)
    this.force = opts.force ?? false
  }

  args(): (string | Path)[] {
    const args = ["unzip"]
    // if (this.opts.verbose) args.push("-v") seems to break it
    if (this.force) args.push("-of")

    return [
      ...args,
      this.opts.zipfile,
      "-d", this.opts.dstdir
    ]
  }

  static supports(filename: Path): boolean {
    return filename.extname() == ".zip"
  }
}
