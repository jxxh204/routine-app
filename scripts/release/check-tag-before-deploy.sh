#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/release/check-tag-before-deploy.sh [<tag>]
#
# If <tag> is omitted, this script checks whether HEAD has at least one tag.
# If <tag> is provided, this script checks whether the provided tag exists locally.

TAG_REGEX='^v[0-9]{4}\.[0-9]{2}\.[0-9]{2}-[0-9]+$'

provided_tag="${1:-}"

if [[ -n "$provided_tag" ]]; then
  if [[ ! "$provided_tag" =~ $TAG_REGEX ]]; then
    echo "❌ Invalid tag format: $provided_tag"
    echo "   expected: vYYYY.MM.DD-N"
    exit 1
  fi

  if ! git rev-parse -q --verify "refs/tags/$provided_tag" >/dev/null; then
    echo "❌ Tag not found locally: $provided_tag"
    echo "   create: git tag -a $provided_tag -m \"release notes\""
    exit 1
  fi

  echo "✅ Tag format and local existence verified: $provided_tag"
  exit 0
fi

head_tags=$(git tag --points-at HEAD)
if [[ -z "$head_tags" ]]; then
  echo "❌ HEAD is not tagged."
  echo "   create tag first (example): git tag -a v2026.03.17-1 -m \"release notes\""
  exit 1
fi

echo "✅ HEAD tag check passed:"
echo "$head_tags"
