#!/usr/bin/env -S pkgx +git +gh +jq +gum +npx +deno bash -eo pipefail

# the back and forth here is because draft releases cannot trigger
# GitHub Actions 😒

if ! git diff-index --quiet HEAD --; then
  echo "error: dirty working tree" >&2
  exit 1
fi

if [ "$(git rev-parse --abbrev-ref HEAD)" != v1/main ]; then
  echo "error: requires main branch" >&2
  exit 1
fi

# ensure we have the latest version tags
git fetch origin -pft

versions="$(git tag | grep '^v1\.[0-9]\+\.[0-9]\+')"
v_latest="$(npx -- semver --include-prerelease $versions | tail -n1)"

_is_prerelease() {
  deno run - <<EoTS
    import { parse } from "https://deno.land/x/semver/mod.ts";
    console.log(parse('$1')?.prerelease.length ? 'true' : 'false');
EoTS
}

case $1 in
major|minor|patch|prerelease)
  v_new=$(npx -- semver bump $v_latest --increment $1)
  ;;
"")
  echo "usage $0 <major|minor|patch|prerelease|VERSION>" >&2
  exit 1;;
*)
  v_new=$1
  ;;
esac

if [ $v_new = $v_latest ]; then
  echo "$v_new already exists!" >&2
  exit 1
fi

gum confirm "prepare draft release for $v_new?" || exit 1

git push origin v1/main

is_prerelease=$(_is_prerelease $v_new)

gh release create \
  v$v_new \
  --draft=true \
  --prerelease=$is_prerelease \
  --generate-notes \
  --notes-start-tag=v$v_latest \
  --latest=false \
  --title=v$v_new

gh workflow run cd.yml --ref=v1/main --raw-field version="$v_new"
# ^^ infuriatingly does not tell us the ID of the run

gum spin --title 'sleeping 5s because GitHub API is slow' -- sleep 5

run_id=$(gh run list --json databaseId --branch=v1/main --workflow=cd.yml | jq '.[0].databaseId')

if ! gh run watch --exit-status $run_id; then
  foo=$?
  gum format -- "> gh run view --web $run_id"
  exit $foo
fi

gh release view v$v_new

gum confirm "draft prepared, release $v_new?" || exit 1

gh release edit \
  v$v_new \
  --verify-tag \
  --latest=false \
  --draft=false \
  --discussion-category=Announcements

gh release view v$v_new --web
