import Path from "path"
import useConfig from "hooks/useConfig.ts"

export class Prefix extends Path {
  www: Path

  constructor(prefix: Path) {
    super(prefix)
    this.www = prefix.join("tea.xyz/var/www")
  }
}

export default function usePrefix() {
  const { teaPrefix } = useConfig()
  return new Prefix(teaPrefix)
}
