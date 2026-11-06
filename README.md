# Sefer Viewer (Tauri v2)

Verse-by-verse viewer for the American Standard Version (1901), bundled at `src-tauri/resources/ASV.db` (opened read-only).

    npm install
    npm run dev
    npm run build

The source database stores every verse 2-3 times (the first copy has glued words and lacks Psalm titles).
On startup the app builds a clean, de-duplicated, indexed copy in memory (see `build_clean_tables` in `src-tauri/src/main.rs`).

## Installation (windows)
- download the codes (zip)
- unzip and install Sefer Viewer_0.1.0_x64_installer

Keys: ← previous verse, → next verse, / opens Search. Book/Chapter/Verse inputs autocomplete; History ▾ keeps the last 100 locations.


## Buiding in debian or mac

The command is the same on both: `npm run build` (which runs `tauri build`). Tauri builds for the OS it runs on, so each platform needs its own build. You can't produce a Mac app from Debian or the other way round.

**Debian**
- Install the system libraries first: `sudo apt install libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`. You also need Rust and Node.
- The output is in `src-tauri/target/release/bundle/`, as `.deb` and `.AppImage` files (`.rpm` as well if `rpmbuild` is installed).

**macOS**
- Install the Xcode command line tools (`xcode-select --install`), plus Rust and Node.
- The output is in `src-tauri/target/release/bundle/`, as a `.app` in `macos/` and a `.dmg` in `dmg/`.
- Without Apple code signing and notarization, the app works on your own machine. Other Macs will show a "can't be opened" warning that people have to click through.

The database is bundled through `"resources": ["resources/*"]` in `tauri.conf.json`, so it ends up inside the package on both systems with no extra steps.
