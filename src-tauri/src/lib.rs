use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{path::BaseDirectory, Manager, State};

/// (table prefix, file name, display label)
const TRANSLATIONS: [(&str, &str, &str); 2] = [
    ("ASV", "ASV.db", "American Standard Version"),
    ("TagAngBiblia", "TagAngBiblia.db", "Tagalog (Ang Biblia, 1905)"),
];

#[derive(Clone, Serialize)]
struct Verse {
    book_id: u32,
    book: String,
    chapter: u32,
    verse: u32,
    text: String,
}

struct Translation {
    books: Vec<String>,
    verses: Vec<Verse>,
}

struct Bible(HashMap<String, Translation>);

#[derive(Serialize)]
struct TranslationInfo {
    id: String,
    label: String,
}

#[derive(Serialize)]
struct BookInfo {
    id: u32,
    name: String,
    /// verse count for each chapter; index 0 = chapter 1
    chapters: Vec<u32>,
}

fn load(path: &PathBuf, prefix: &str) -> Result<Translation, String> {
    let conn = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("{}: {e}", path.display()))?;

    let mut books: Vec<String> = vec![String::new()]; // index = book id
    let mut stmt = conn
        .prepare(&format!("SELECT id, name FROM {prefix}_books ORDER BY id"))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, u32>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    for row in rows {
        let (id, name) = row.map_err(|e| e.to_string())?;
        while books.len() <= id as usize {
            books.push(String::new());
        }
        books[id as usize] = name;
    }

    // Ordered canonically; the Tagalog file contains a few exact duplicate
    // verses, so keep only the first of each (book, chapter, verse).
    let mut stmt = conn
        .prepare(&format!(
            "SELECT book_id, chapter, verse, text FROM {prefix}_verses \
             ORDER BY book_id, chapter, verse, id"
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, u32>(0)?,
                r.get::<_, u32>(1)?,
                r.get::<_, u32>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut verses: Vec<Verse> = Vec::with_capacity(24_000);
    let mut last = (0, 0, 0);
    for row in rows {
        let (b, c, v, text) = row.map_err(|e| e.to_string())?;
        if (b, c, v) == last {
            continue;
        }
        last = (b, c, v);
        verses.push(Verse {
            book_id: b,
            book: books.get(b as usize).cloned().unwrap_or_default(),
            chapter: c,
            verse: v,
            text: text.trim().to_string(),
        });
    }
    Ok(Translation { books, verses })
}

#[tauri::command]
fn translations() -> Vec<TranslationInfo> {
    TRANSLATIONS
        .iter()
        .map(|(id, _, label)| TranslationInfo {
            id: id.to_string(),
            label: label.to_string(),
        })
        .collect()
}

#[tauri::command]
fn books(bible: State<Bible>, translation: String) -> Result<Vec<BookInfo>, String> {
    let t = bible.0.get(&translation).ok_or("unknown translation")?;
    let mut out: Vec<BookInfo> = Vec::new();
    for v in &t.verses {
        if out.last().map(|b| b.id) != Some(v.book_id) {
            out.push(BookInfo {
                id: v.book_id,
                name: v.book.clone(),
                chapters: vec![],
            });
        }
        let b = out.last_mut().unwrap();
        while b.chapters.len() < v.chapter as usize {
            b.chapters.push(0);
        }
        b.chapters[v.chapter as usize - 1] = b.chapters[v.chapter as usize - 1].max(v.verse);
    }
    let _ = &t.books;
    Ok(out)
}

/// Number of verses in the translation.
#[tauri::command]
fn total(bible: State<Bible>, translation: String) -> Result<usize, String> {
    Ok(bible.0.get(&translation).ok_or("unknown translation")?.verses.len())
}

/// Verse at a linear position. Out of range wraps around so the reader can
/// loop from Malachi back to Genesis (and the reverse).
#[tauri::command]
fn verse_at(bible: State<Bible>, translation: String, index: i64) -> Result<(usize, Verse), String> {
    let t = bible.0.get(&translation).ok_or("unknown translation")?;
    let n = t.verses.len() as i64;
    let i = index.rem_euclid(n) as usize;
    Ok((i, t.verses[i].clone()))
}

/// Linear position of a reference; if the exact verse doesn't exist in this
/// translation, the nearest earlier verse in that chapter (or book) is used.
#[tauri::command]
fn find(bible: State<Bible>, translation: String, book_id: u32, chapter: u32, verse: u32) -> Result<usize, String> {
    let t = bible.0.get(&translation).ok_or("unknown translation")?;
    let key = (book_id, chapter, verse);
    let pos = t
        .verses
        .partition_point(|v| (v.book_id, v.chapter, v.verse) < key);
    Ok(pos.min(t.verses.len() - 1))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let mut map = HashMap::new();
            for (id, file, _) in TRANSLATIONS {
                let path = app
                    .path()
                    .resolve(format!("resources/{file}"), BaseDirectory::Resource)
                    .map_err(|e| e.to_string())?;
                map.insert(id.to_string(), load(&path, id)?);
            }
            app.manage(Bible(map));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![translations, books, total, verse_at, find])
        .run(tauri::generate_context!())
        .expect("error while running sefer-desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_both_translations() {
        for (id, file, _) in TRANSLATIONS {
            let p = PathBuf::from(format!("resources/{file}"));
            let t = load(&p, id).unwrap();
            assert_eq!(t.verses.len(), 23145, "{id}");
            assert_eq!((t.verses[0].book.as_str(), t.verses[0].chapter, t.verses[0].verse), ("Genesis", 1, 1));
            let l = t.verses.last().unwrap();
            assert_eq!((l.book.as_str(), l.chapter, l.verse), ("Malachi", 4, 6));
        }
    }
}
