#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-env=AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY,S3_BUCKET
  - --import-map={{ srcroot }}/import-map.json
---*/

import { S3 } from "s3";
import { stringify as yaml } from "deno/encoding/yaml.ts"
import { stringify as csv } from "deno/encoding/csv.ts"
import { Inventory } from "../src/hooks/useInventory.ts";

const s3 = new S3({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: "us-east-1",
});

const bucket = s3.getBucket(Deno.env.get("S3_BUCKET")!);

const inventory: Inventory = {}
const flat = []

for await (const pkg of bucket.listAllObjects({ batchSize: 200 })) {
  if (!pkg.key?.endsWith('.tar.gz')) { continue }

  const matches = pkg.key.match(new RegExp("^(.*)/(.*)/(.*)/v([0-9]+\.[0-9]+\.[0-9]+)\.tar\.gz$"))

  if (!matches) { continue }

  const [_, project, platform, arch, version] = matches

  if (!inventory[project]) inventory[project] = {}
  if (!inventory[project][platform]) inventory[project][platform] = {}
  if (!inventory[project][platform]) inventory[project][platform] = {}
  inventory[project][platform][arch] = [...(inventory[project]?.[platform]?.[arch] ?? []), version]
  flat.push({ project, platform, arch, version })
}

/// For ultimate user-friendliness, we store this data 4 ways:
/// YAML, JSON, CSV, flat text

const te = new TextEncoder()

// YAML: type Inventory

const yml = te.encode(yaml(inventory))

bucket.putObject("versions.yml", yml)

// JSON: type Inventory

const json = te.encode(JSON.stringify(inventory))

bucket.putObject("versions.json", json)

// CSV: project,platform,arch,version

const csvData = te.encode(await csv(flat, ["project", "platform", "arch", "version"]))

bucket.putObject("versions.csv", csvData)

// TXT: per project/platform/arch, newline-delimited

for(const [project, platforms] of Object.entries(inventory)) {
  for (const [platform, archs] of Object.entries(platforms)) {
    for (const [arch, versions] of Object.entries(archs)) {
      const txt = te.encode(versions.join("\n"))
      bucket.putObject(`${project}/${platform}/${arch}/versions.txt`, txt)
    }
  }
}

//end
