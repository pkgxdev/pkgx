import Path from "path"

export default {
  envPath,
  addPath,
  rmPath,
  findBinary,
}

function envPath(pathVar: string | undefined = undefined): Path[] {
  const pathVar_ = pathVar || Deno.env.get("PATH")!
  return pathVar_.split(":").map(x => new Path(x))
}

function addPath(path: Path | string, pathVar: string | undefined = undefined): Path[] {
  const pathVar_ = envPath(pathVar)
  const path_ = new Path(path)
  if (!pathVar_.includes(path_)) {
    pathVar_.push(path_)
    Deno.env.set("PATH", pathVar_.join(":"))
  }
  return pathVar_
}

function rmPath(path: Path | string, pathVar: string | undefined = undefined): Path[] {
  const path_ = new Path(path)
  const pathVar_ = envPath(pathVar).filter(x => x.string != path_.string)
  Deno.env.set("PATH", pathVar_.join(":"))
  return pathVar_
}

function findBinary(name: string, pathVar: string | Path[] | undefined = undefined): Path | undefined {
  let pathVar_: Path[]
  if (pathVar instanceof Array) {
    pathVar_ = pathVar
  } else {
    pathVar_ = envPath(pathVar)
  }
  return pathVar_.find(x => x.join(name).isExecutableFile())?.join(name)
}
