#!/usr/bin/env -S tea +git +gh +jq +gum +npx +deno bash -eo pipefail

if ! git diff-index --quiet HEAD --; then
  echo "error: dirty working tree" >&2
  exit 1
fi

if [ "$(git rev-parse --abbrev-ref HEAD)" != main ]; then
  echo "error: requires main branch" >&2
  exit 1
fi

# ensure we have the latest version tags
git fetch origin -pft

versions="$(git tag | grep '^v[0-9]\+\.[0-9]\+\.[0-9]\+')"
v_latest="$(npx -- semver --include-prerelease $versions | tail -n1)"

is_prerelease() {
  deno run - <<EoTS
    import { parse } from "https://deno.land/x/semver/mod.ts";
    console.log(parse('$1')?.prerelease.length ? 'true' : 'false);
EoTS
}

case $1 in
major|minor|patch|prerelease)
  v_new=$(npx semver bump $v_latest $1)
  ;;
"")
  echo "usage $0 <major|minor|patch|prerelease|VERSION>" >&2
  exit 1;;
*)
  v_new=$1
  ;;
esac

if is_prerelease $v_new; then
  prerelease=true
else
  prerelease=false
fi

gum confirm "release $v_new?" || exit 1

git push origin main

gh release create \
  --draft=true \
  --prelease=$(is_prerelease $v_new) \
  --generate-notes \
  --notes-start-tag=$v_latest \
  --title=$v_new \
  --tag=$v_new \
  --discussion-category=Announcements

gh workflow run cd.yml -f version="$v_new"

run_id=$(gh -R teaxyz/pantry run list --json databaseId --workflow cd | jq '.[0].databaseId')

gh workflow view --web $run_id

gh run watch --exit-status $run_id

gum confirm "draft prepared, release $v_new?" || exit 1

gh release edit \
  --verify-tag \
  --tag $v_new \
  --latest \
  --draft=false

gh release view $v_new --web
