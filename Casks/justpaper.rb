cask "justpaper" do
  version "0.3.0"
  sha256 "5dc58beed4cec5175cdbae95bc94d949a29b111967f0d42b60657336a4308e99"

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
