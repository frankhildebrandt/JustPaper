cask "justpaper" do
  arch arm: "aarch64", intel: "x64"

  version "0.1.0"
  sha256 arm:   "a0f45f1682c3b3552f3dc2651466d7a74ced7d446625d2bff1bc6496337522d2",
         intel: "a3c5a68577a5730197b6c5b99a42b0004c1d20c86de6f14c04b40d51d5b237d2"

  url "https://github.com/frankhildebrandt/JustPaper/releases/download/v#{version}/JustPaper_#{version}_#{arch}.dmg",
      verified: "github.com/frankhildebrandt/JustPaper/"
  name "JustPaper"
  desc "Frameless typewriter on a sheet of paper"
  homepage "https://github.com/frankhildebrandt/JustPaper"

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
