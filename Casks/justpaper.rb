cask "justpaper" do
  version "0.3.1"
  sha256 "c9f66553c1a9427ee78f7bd6b0f38373e6f5ffa2aff44a7b5b68833d1ffbe302"

  url "https://github.com/frankhildebrandt/JustPaper/releases/download/v#{version}/JustPaper_#{version}_aarch64.dmg",
      verified: "github.com/frankhildebrandt/JustPaper/"
  name "JustPaper"
  desc "Frameless typewriter on a sheet of paper"
  homepage "https://github.com/frankhildebrandt/JustPaper"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :high_sierra"
  depends_on arch: :arm64

  app "JustPaper.app"

  uninstall quit: "com.justpaper.app"

  zap trash: [
    "~/Library/Application Support/com.justpaper.app",
    "~/Library/Caches/com.justpaper.app",
    "~/Library/Preferences/com.justpaper.app.plist",
    "~/Library/WebKit/com.justpaper.app",
  ]
end
