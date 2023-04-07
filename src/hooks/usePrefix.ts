import Path from "path"
import useConfig from "hooks/useConfig.ts"

export class Prefix extends Path {
  www: Path
  bin: Path

  constructor(prefix: Path) {
    super(prefix)
    this.www = prefix.join("tea.xyz/var/www")
    // Maybe this should be usr/bin or tmp/bin?
    this.bin = prefix.join("tea.xyz/bin")
  }
}

export default function usePrefix() {
  const { teaPrefix } = useConfig()
  return new Prefix(teaPrefix)
}
