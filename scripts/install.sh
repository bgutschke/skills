#!/usr/bin/env bash
set -euo pipefail

# Copies one or more skills from this repo into a target project as
# editable files ("skills.sh" philosophy, adapted for a private repo:
# clone once, then copy from the local clone instead of fetching over
# the public GitHub API).
#
# Usage:
#   scripts/install.sh <skill-name> [<skill-name> ...] [--target <dir>]
#
# Defaults the target to ./.claude/skills relative to the current directory.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
TARGET=".claude/skills"
names=()

while [ $# -gt 0 ]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    *)
      names+=("$1")
      shift
      ;;
  esac
done

if [ ${#names[@]} -eq 0 ]; then
  echo "usage: $0 <skill-name> [<skill-name> ...] [--target <dir>]" >&2
  echo >&2
  echo "available skills:" >&2
  "$REPO/scripts/list-skills.sh" | sed 's/^/  /' >&2
  exit 1
fi

mkdir -p "$TARGET"

for name in "${names[@]}"; do
  src=$(find "$REPO/skills" -type d -name "$name" -not -path '*/node_modules/*' | head -n1)
  if [ -z "$src" ]; then
    echo "error: no skill named '$name' found under $REPO/skills" >&2
    exit 1
  fi
  dest="$TARGET/$name"
  if [ -e "$dest" ]; then
    rm -rf "$dest"
  fi
  cp -R "$src" "$dest"
  echo "installed $name -> $dest"
done
