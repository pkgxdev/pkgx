import { SSQL, SSQLTable } from "ssql"
import Path from "path"
import { Provider } from "hooks/useDarkMagic.ts";

const REVISION = 0

export class DarkMagicChoice extends SSQLTable {
  bin = ""
  provider: Provider | undefined = undefined
}

export class Config extends SSQLTable {
  key = ""
  value = ""
}

export default class Db {
  db: SSQL
  static models = [
    Config,
    DarkMagicChoice,
  ]

  constructor(db: Path | undefined = undefined) {
    const db_ = db ?? Path.home().join(".local/state/tea/db.sqlite3")
    if (!db_.parent().isDirectory()) db_.mkparent()
    this.db = new SSQL(db_.string, Db.models)

    const versions = this.db.findMany(Config, { where: { clause: "key = ?", values: ["version"] }, limit: 1 })
    if (versions.length == 0) {
      const version = new Config()
      version.key = "version"
      version.value = REVISION.toString()
      this.db.save(version)
    } else if (+versions[0].value < REVISION) {
      this.migrate(+versions[0].value)
    }
  }

  close() {
    this.db.db.close()
  }

  private migrate(_from: number) {
    // nothing to do yet; future migrations go here.
    const version = new Config()
    version.key = "version"
    version.value = REVISION.toString()
    this.db.save(version)
  }

  public findDarkMagicChoice(bin: string): DarkMagicChoice | undefined {
    const choices = this.db.findMany(DarkMagicChoice, { where: { clause: "bin = ?", values: [bin] }, limit: 1 })
    if (choices.length == 0) return undefined
    return choices[0]
  }

  public setDarkMagicChoice(bin: string, provider: Provider): DarkMagicChoice {
    const choice = this.findDarkMagicChoice(bin) ?? new DarkMagicChoice()
    choice.bin = bin
    choice.provider = provider
    this.db.save(choice)
    return choice
  }
}