#!/usr/bin/env bash
# Rewrites the Homebrew cask and Arch PKGBUILD checksums for a GitHub release tag.
set -euo pipefail

version="${1:?usage: update-cask.sh <version>}"
repo="${GITHUB_REPOSITORY:-frankhildebrandt/JustPaper}"
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

gh release download "v${version}" --repo "$repo" --pattern "*.dmg" --dir "$work"

arm_dmg="$(find "$work" -name "*_aarch64.dmg" | head -n 1)"
intel_dmg="$(find "$work" \( -name "*_x64.dmg" -o -name "*_x86_64.dmg" \) | head -n 1)"
if [[ -z "$arm_dmg" || -z "$intel_dmg" ]]; then
  echo "expected aarch64 and x64/x86_64 dmg assets, got:" >&2
  ls -la "$work" >&2
  exit 1
fi

arm_sha="$(shasum -a 256 "$arm_dmg" | awk '{print $1}')"
intel_sha="$(shasum -a 256 "$intel_dmg" | awk '{print $1}')"
intel_arch="x64"
[[ "$intel_dmg" == *x86_64* ]] && intel_arch="x86_64"

cat > "$root/Casks/justpaper.rb" <<RUBY
cask "justpaper" do
  arch arm: "aarch64", intel: "${intel_arch}"

  version "${version}"
  sha256 arm:   "${arm_sha}",
         intel: "${intel_sha}"

  url "https://github.com/${repo}/releases/download/v#{version}/JustPaper_#{version}_#{arch}.dmg",
      verified: "github.com/${repo}/"
  name "JustPaper"
  desc "Frameless typewriter on a sheet of paper"
  homepage "https://github.com/${repo}"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :high_sierra"

  app "JustPaper.app"

  uninstall quit: "com.justpaper.app"

  zap trash: [
    "~/Library/Application Support/com.justpaper.app",
    "~/Library/Caches/com.justpaper.app",
    "~/Library/Preferences/com.justpaper.app.plist",
    "~/Library/WebKit/com.justpaper.app",
  ]
end
RUBY

archive="$work/source.tar.gz"
curl -fsSL "https://github.com/${repo}/archive/refs/tags/v${version}.tar.gz" -o "$archive"
src_sha="$(shasum -a 256 "$archive" | awk '{print $1}')"
desktop_sha="$(shasum -a 256 "$root/packaging/arch/justpaper.desktop" | awk '{print $1}')"

python3 - "$root/packaging/arch/PKGBUILD" "$version" "$src_sha" "$desktop_sha" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
version, src_sha, desktop_sha = sys.argv[2], sys.argv[3], sys.argv[4]
text = path.read_text()
text = re.sub(r"^pkgver=.*$", f"pkgver={version}", text, count=1, flags=re.M)
text = re.sub(
    r"^sha256sums=\([^)]*\)",
    f"sha256sums=('{src_sha}'\n            '{desktop_sha}')",
    text,
    count=1,
    flags=re.M,
)
path.write_text(text)
PY

echo "updated cask and PKGBUILD for v${version}"
