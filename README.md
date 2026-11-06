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
