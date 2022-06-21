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
import { crypto } from "deno/crypto/mod.ts";
import { readerFromStreamReader, readAll } from "deno/streams/conversion.ts";
import { encodeToString } from "encodeToString";

const s3 = new S3({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: "us-east-1",
});

const bucket = s3.getBucket(Deno.env.get("S3_BUCKET")!);

for await (const pkg of bucket.listAllObjects({ batchSize: 200 })) {
  if (!pkg.key?.endsWith('.tar.gz')) { continue }
  console.log({ checking: pkg.key });

  if (!await bucket.headObject(`${pkg.key}.sha256sum`)) {
    console.log({ missingChecksum: pkg.key })
    const reader = (await bucket.getObject(pkg.key))!.body.getReader()
    const contents = await readAll(readerFromStreamReader(reader))

    const basename = pkg.key.split("/").pop()
    const sha256sum = encodeToString(new Uint8Array(await crypto.subtle.digest("SHA-256", contents)))
    const body = new TextEncoder().encode(`${sha256sum}  ${basename}`)

    await bucket.putObject(`${pkg.key}.sha256sum`, body);

    console.log({ uploaded: `${pkg.key}.sha256sum` });
  }
}
