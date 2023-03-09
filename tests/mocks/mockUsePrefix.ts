import { default as realUsePrefix, Prefix } from "../../src/hooks/usePrefix.ts"
import Path from "path"

let mockPrefixPath: Path | undefined;

export const setTeaPrefix = (prefix: string | Path) => mockPrefixPath = new Path(prefix);

export default function usePrefix() {
  if (mockPrefixPath) {
    return (new Prefix(mockPrefixPath));
  }
  return realUsePrefix()
}
