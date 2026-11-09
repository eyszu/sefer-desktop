# sefer-desktop

A full-screen Bible verse viewer built with Tauri 2.

- **←** previous verse, **→** next verse (wraps Malachi ↔ Genesis).
- Verse text auto-sizes to fill the window (can be switched to a fixed size).
- Gear button (press ` for shortcut) opens Settings:
  translation, theme (light / dark / dusk / dawn), background (6 sample gradients or your own image + dim),
  font (Lora / Inter / Cormorant Garamond), go-to-verse, and the last 30 verses viewed.
- Translations: ASV and Tagalog Ang Biblia (SQLite files in `src-tauri/resources/`).

## Run / build
Prereqs: Rust, Node, and the Tauri system deps (Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev patchelf`).

    npm install
    npm run dev      # development
    npm run build    # installers in src-tauri/target/release/bundle

### Prebuilt for windows
- download and install sefer-desktop_0.1.0_x64_en-US
