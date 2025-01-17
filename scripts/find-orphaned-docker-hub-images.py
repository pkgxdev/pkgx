#!/usr/bin/env -S pkgx +python@3.11 uv run --script
# /// script
# dependencies = [
#   "requests"
# ]
# ///

import requests
from collections import defaultdict
from pprint import pprint

def get_all_tags_and_digests(image_name):
    """
    Fetches all tags and their digests for a Docker Hub image, handling pagination.
    """
    base_url = f"https://registry.hub.docker.com/v2/repositories/{image_name}/tags"
    tags_and_digests = []
    url = base_url

    while url:
        response = requests.get(url)
        if response.status_code != 200:
            print(f"Failed to fetch data: {response.status_code}, {response.text}")
            return []

        data = response.json()
        for result in data['results']:
            tag = result['name']
            digest = result['digest']
            if digest:
                tags_and_digests.append((tag, digest))

        url = data.get('next')  # Get the next page URL

    return tags_and_digests

def find_orphaned_tags(tags_and_digests):
    """Identifies tags with unique digests."""
    digest_count = defaultdict(int)
    for _, digest in tags_and_digests:
        digest_count[digest] += 1

    orphaned_tags = [tag for tag, digest in tags_and_digests if digest_count[digest] == 1]
    return orphaned_tags

if __name__ == "__main__":
    image_name = "pkgxdev/pkgx"
    tags_and_digests = get_all_tags_and_digests(image_name)
    if tags_and_digests:
        orphaned_tags = find_orphaned_tags(tags_and_digests)
        if len(orphaned_tags) > 0:
            print("orphans:")
            for tag in orphaned_tags:
                print(tag)
        else:
            print("no orphans, here’s the tags instead:")
            tags = [tag for tag, _ in tags_and_digests if tag.startswith('v')]
            pprint(sorted(tags))
