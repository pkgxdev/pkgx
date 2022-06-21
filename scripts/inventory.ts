#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-env=AWS_ACCESS_KEY_ID,AWS_SECRET_ACCESS_KEY,S3_BUCKET
  - --import-map={{ srcroot }}/import-map.json
---*/

import { S3 } from "https://deno.land/x/s3@0.5.0/mod.ts";
import { stringify as yaml } from "deno/encoding/yaml.ts"

const s3 = new S3({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: "us-east-1",
});

const bucket = s3.getBucket(Deno.env.get("S3_BUCKET")!);

const inventory: Inventory = {}

for await (const pkg of bucket.listAllObjects({ batchSize: 200 })) {
  if (!pkg.key?.endsWith('.tar.gz')) { continue }

  const matches = pkg.key.match(new RegExp("^(.*)/(.*)/(.*)/v([0-9]+\.[0-9]+\.[0-9]+)\.tar\.gz$"))

  if (!matches) { continue }

  const [_, project, platform, arch, version] = matches

  if (!inventory[project]) inventory[project] = {}
  if (!inventory[project][platform]) inventory[project][platform] = {}
  if (!inventory[project][platform]) inventory[project][platform] = {}
  inventory[project][platform][arch] = [...(inventory[project]?.[platform]?.[arch] ?? []), version]
}

const contents = new TextEncoder().encode(yaml(inventory))

bucket.putObject("versions.yaml", contents)
//end

type Inventory = {
  [project: string]: {
    [platform: string]: {
      [arch: string]: string[]
    }
  }
}