#!/usr/bin/env -S pkgx +git +gh +jq +gum bash -eo pipefail

if ! git diff-index --quiet HEAD --; then
  echo "error: dirty working tree" >&2
  exit 1
fi

if [ "$(git rev-parse --abbrev-ref HEAD)" != main ]; then
  echo "error: requires main branch" >&2
  exit 1
fi

v_new=$(cargo metadata --format-version 1 --no-deps | jq -r '.packages[] | select(.name == "pkgx") | .version')

case $(gh release view --json isDraft | jq .isDraft) in
'release not found')
  gum confirm "prepare draft release for $v_new?" || exit 1

  gh release create \
    v$v_new \
    --draft=true \
    --prerelease=$is_prerelease \
    --generate-notes \
    --notes-start-tag=v$v_latest \
    --title=v$v_new

  ;;
true)
  gum format "> existing $v_new draft found, using that"
  echo  #spacer
  ;;
false)
  gum format "$v_new already published! edit \`./crates/cli/Cargo.toml\`"
  exit 1;;
esac

git push origin main

gh workflow run cd.yml --raw-field version="$v_new"
# ^^ infuriatingly does not tell us the ID of the run

gum spin --title 'sleeping 5s because GitHub API is slow' -- sleep 5

run_id=$(gh run list --json databaseId --workflow=cd.yml | jq '.[0].databaseId')

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
  $(if [ $is_prerelease = false ]; then echo --latest; fi) \
  --draft=false \
  --discussion-category=Announcements

gh release view v$v_new --web
