use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::CompressionMethod;

pub fn compress_directory(
    source_path: &str,
    output_zip: &str,
    exclusions: Vec<String>,
) -> Result<(), String> {
    let source_dir = Path::new(source_path);
    let zip_file = File::create(output_zip).map_err(|e| e.to_string())?;

    let mut zip = zip::ZipWriter::new(zip_file);
    let options: FileOptions<'_, ()> = FileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let walker = WalkDir::new(source_dir).into_iter();

    for entry in walker.filter_map(|e| e.ok()) {
        let path = entry.path();

        // Check exclusions
        let mut exclude = false;
        for ex in &exclusions {
            if path.components().any(|c| c.as_os_str().to_string_lossy() == *ex) {
                exclude = true;
                break;
            }
        }

        if exclude {
            continue;
        }

        let name = path.strip_prefix(source_dir).unwrap_or(path);
        let name_str = name.to_string_lossy().replace('\\', "/");

        if path.is_file() {
            zip.start_file(name_str, options.clone()).map_err(|e| e.to_string())?;
            let mut f = File::open(path).map_err(|e| e.to_string())?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
        } else if !name.as_os_str().is_empty() {
            zip.add_directory(name_str, options.clone()).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}
