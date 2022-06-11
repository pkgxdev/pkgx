#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-env
  - --allow-read=/opt/tea.xyz/var/www
  - --import-map={{ srcroot }}/import-map.json
---*/

import { S3 } from "https://deno.land/x/s3@0.5.0/mod.ts";
import useCache from "hooks/useCache.ts";

const s3 = new S3({
  accessKeyID: Deno.env.get("AWS_ACCESS_KEY_ID")!,
  secretKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  region: "us-east-1",
});

const bucket = s3.getBucket(Deno.env.get("S3_BUCKET")!);

for (const pkg of await useCache().ls()) {
  const key = useCache().s3Key(pkg)
  const bottle = useCache().bottle(pkg)

  console.log({ checking: key });

  if (!await bucket.headObject(key)) {
    // path.read() returns a string; this is easier to get a UInt8Array
    const contents = await Deno.readFile(bottle.string);

    await bucket.putObject(key, contents);

    console.log({ uploaded: key });
  }
}
