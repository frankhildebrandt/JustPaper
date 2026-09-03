# JustPaper

A frameless typewriter on a sheet of paper. One quiet window, local markdown and Typst files, no cloud and no file tree.

Open a single note, or a folder as a project. Then jump with **⌘P** / **Ctrl+P**, search with **⇧⌘P** / **Ctrl+Shift+P**, and follow `[[wikilinks]]`. Autosave keeps the current file on disk.

## Install

Release binaries are published for **macOS** (Apple Silicon), **Windows**, **Ubuntu** (`.deb`), and generic Linux (**AppImage**, also the Arch path).

### macOS (Homebrew Cask)

```bash
brew tap frankhildebrandt/justpaper
brew install --cask justpaper
```

Or download the `.dmg` from [Releases](https://github.com/frankhildebrandt/JustPaper/releases). macOS builds are signed with Developer ID and notarized.

### Ubuntu

Download the `.deb` from [Releases](https://github.com/frankhildebrandt/JustPaper/releases) and install it:

```bash
sudo apt install ./justpaper_*_amd64.deb
```

### Arch Linux

A source package lives in [`packaging/arch`](packaging/arch):

```bash
cd packaging/arch
makepkg -si
```

You can also run the **AppImage** from Releases.

### Windows

Download the NSIS installer (`*-setup.exe`) from [Releases](https://github.com/frankhildebrandt/JustPaper/releases).

### From source

Need [Node.js](https://nodejs.org/), [Rust](https://rustup.rs/), and on Linux the WebKitGTK 4.1 development packages.

```bash
npm install
npm test
npm run tauri dev      # development
npm run tauri build    # platform bundle
```

On macOS, `make install` builds the app and copies it to `/Applications`.

## License

Copyright (C) 2026 Frank Hildebrandt.

JustPaper is **AGPLv3**. Bundled libraries are compatible (MIT, Apache-2.0, Unlicense, SIL OFL-1.1 for Courier Prime). See [LICENSE](LICENSE).
