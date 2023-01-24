import useRequirementsFile from "./useRequirementsFile.ts"

const version = `${(
  await useRequirementsFile(
    new URL(import.meta.url).path()
      .parent().parent().parent()
      .join("README.md")
  ).swallow(/not-found/))?.version}+dev`

export default function() {
  return version
}

// we statically replace this file at deployment
