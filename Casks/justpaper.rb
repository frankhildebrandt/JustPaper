cask "justpaper" do
  version "0.2.0"
  sha256 "1784127c7b0a948b07e524e763d3e50b43c459b8957bca76aa77efe2ff912c07"

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
