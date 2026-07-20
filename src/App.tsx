import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FolderUp, Settings, Info, Play, FileArchive, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import JSZip from "jszip";

interface ProjectAnalysis {
  project_type: string;
  total_files: number;
  total_size_bytes: number;
  recommended_exclusions: string[];
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Detect if running in Tauri native app environment
const isTauri = typeof window !== "undefined" && (
  (window as any).__TAURI_IPC__ !== undefined || 
  (window as any).__TAURI_INTERNALS__ !== undefined
);

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [browserFiles, setBrowserFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionDone, setCompressionDone] = useState(false);

  async function handleSelectFolder() {
    if (isTauri) {
      try {
        const selected = await invoke<string | null>("select_directory");
        if (selected) {
          setFolderPath(selected);
          setCompressionDone(false);
          const data = await invoke<ProjectAnalysis>("analyze_project", { path: selected });
          setAnalysis(data);
        }
      } catch (error) {
        console.error(error);
      }
    } else {
      document.getElementById("folder-input")?.click();
    }
  }

  function processBrowserFiles(files: File[]) {
    if (files.length === 0) return;
    
    setBrowserFiles(files);
    setCompressionDone(false);

    let totalFiles = 0;
    let totalSize = 0;
    let projectType = "Unknown";
    
    // Root directory name is the first segment of webkitRelativePath
    const firstRelativePath = files[0].webkitRelativePath || files[0].name;
    const rootFolderName = firstRelativePath.split('/')[0] || "project";
    setFolderPath(rootFolderName);

    let hasPackageJson = false;
    let hasCargoToml = false;
    let hasRequirements = false;
    let hasPyProject = false;
    let hasPom = false;
    let hasBuildGradle = false;

    for (const file of files) {
      totalFiles++;
      totalSize += file.size;

      // Extract the path relative to the root folder
      const relativePath = file.webkitRelativePath || file.name;
      const parts = relativePath.split('/');
      
      // Look for project config files under the root level (e.g. "root/package.json" -> parts.length === 2)
      // Or if there's no directory hierarchy (just files), check parts.length === 1
      if (parts.length === 2 || (parts.length === 1 && !file.webkitRelativePath)) {
        const fileName = parts[parts.length - 1];
        if (fileName === "package.json") hasPackageJson = true;
        if (fileName === "Cargo.toml") hasCargoToml = true;
        if (fileName === "requirements.txt") hasRequirements = true;
        if (fileName === "pyproject.toml") hasPyProject = true;
        if (fileName === "pom.xml") hasPom = true;
        if (fileName === "build.gradle") hasBuildGradle = true;
      }
    }

    const exclusions = [".git", ".vscode", ".idea", ".DS_Store"];

    if (hasPackageJson) {
      projectType = "Node.js (JavaScript/TypeScript)";
      exclusions.push("node_modules", "dist", ".next");
    } else if (hasCargoToml) {
      projectType = "Rust";
      exclusions.push("target");
    } else if (hasRequirements || hasPyProject) {
      projectType = "Python";
      exclusions.push("venv", "__pycache__", ".pytest_cache");
    } else if (hasPom || hasBuildGradle) {
      projectType = "Java";
      exclusions.push("target", "build", ".gradle");
    }

    setAnalysis({
      project_type: projectType,
      total_files: totalFiles,
      total_size_bytes: totalSize,
      recommended_exclusions: exclusions,
    });
  }

  function handleBrowserFolderSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      processBrowserFiles(Array.from(files));
    }
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    if (!e.dataTransfer.items) return;

    const entries: any[] = [];
    for (let i = 0; i < e.dataTransfer.items.length; i++) {
      const item = e.dataTransfer.items[i];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          entries.push(entry);
        }
      }
    }

    if (entries.length > 0) {
      const allFiles: File[] = [];

      const traverse = async (entry: any, path: string = "") => {
        if (entry.isFile) {
          const file = await new Promise<File>((resolve, reject) => {
            entry.file(resolve, reject);
          });
          const relativePath = path ? `${path}/${file.name}` : file.name;
          Object.defineProperty(file, 'webkitRelativePath', {
            value: relativePath,
            writable: true,
            configurable: true
          });
          allFiles.push(file);
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          const readEntries = async (): Promise<any[]> => {
            return new Promise((resolve) => {
              dirReader.readEntries(resolve);
            });
          };

          let dirEntries = await readEntries();
          let allDirEntries: any[] = [];
          while (dirEntries.length > 0) {
            allDirEntries = allDirEntries.concat(dirEntries);
            dirEntries = await readEntries();
          }

          const newPath = path ? `${path}/${entry.name}` : entry.name;
          for (const childEntry of allDirEntries) {
            await traverse(childEntry, newPath);
          }
        }
      };

      for (const entry of entries) {
        await traverse(entry);
      }

      if (allFiles.length > 0) {
        processBrowserFiles(allFiles);
      }
    }
  }

  async function handleCompress() {
    if (!folderPath || !analysis) return;
    setIsCompressing(true);

    if (isTauri) {
      const outputPath = `${folderPath}/developerzip_archive.zip`;
      try {
        await invoke("compress_project", {
          path: folderPath,
          output: outputPath,
          exclusions: analysis.recommended_exclusions
        });
        setCompressionDone(true);
      } catch (e) {
        console.error("Compression failed:", e);
      } finally {
        setIsCompressing(false);
      }
    } else {
      // Browser environment compression
      try {
        const zip = new JSZip();
        const exclusions = analysis.recommended_exclusions;

        for (const file of browserFiles) {
          const relativePath = file.webkitRelativePath || file.name;
          const pathSegments = relativePath.split('/');

          // Check if any path segment matches recommended exclusions
          const shouldExclude = pathSegments.some(segment => exclusions.includes(segment));

          if (!shouldExclude) {
            // Strip the parent directory name to store files flat or structured inside the zip root
            const zipPath = pathSegments.length > 1 ? pathSegments.slice(1).join('/') : relativePath;
            const buffer = await file.arrayBuffer();
            zip.file(zipPath, buffer);
          }
        }

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${folderPath}_archive.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setCompressionDone(true);
      } catch (e) {
        console.error("Browser compression failed:", e);
      } finally {
        setIsCompressing(false);
      }
    }
  }

  function handleClear() {
    setFolderPath(null);
    setBrowserFiles([]);
    setAnalysis(null);
    setCompressionDone(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileArchive className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">DeveloperZip</h1>
            <p className="text-xs text-muted-foreground opacity-80">Intelligent Project Archiver</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 rounded-md hover:bg-secondary/80 transition-colors">
            <Settings className="w-5 h-5 text-secondary-foreground" />
          </button>
          <button className="p-2 rounded-md hover:bg-secondary/80 transition-colors">
            <Info className="w-5 h-5 text-secondary-foreground" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
        {!folderPath ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
            <div 
              onClick={handleSelectFolder} 
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDrop}
              className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-16 flex flex-col items-center justify-center cursor-pointer bg-card/30 hover:bg-card/50 group"
            >
              <div className="p-4 bg-primary/5 rounded-full group-hover:scale-110 transition-transform duration-300 mb-6">
                <FolderUp className="w-12 h-12 text-primary opacity-80" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Drop your project here</h2>
              <p className="text-muted-foreground mb-6">or click to browse</p>
              
              <button className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center space-x-2 shadow-lg shadow-primary/20">
                <span>Browse Folder</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full bg-card border border-border rounded-xl p-8 shadow-sm">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold mb-1">Project Selected</h2>
                <p className="text-muted-foreground font-mono text-sm">{folderPath}</p>
              </div>
              <button onClick={handleClear} className="text-sm text-muted-foreground hover:text-foreground">
                Change
              </button>
            </div>
            
            {analysis ? (
              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="p-4 bg-background rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-1">Detected Type</p>
                    <p className="font-semibold text-lg">{analysis.project_type}</p>
                 </div>
                 <div className="p-4 bg-background rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground mb-1">Raw Size</p>
                    <p className="font-semibold text-lg">{formatBytes(analysis.total_size_bytes)} in {analysis.total_files} files</p>
                 </div>
                 <div className="col-span-2 p-4 bg-background rounded-lg border border-border mt-2">
                    <p className="text-sm text-muted-foreground mb-2">AI Suggested Exclusions</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.recommended_exclusions.map(ex => (
                        <span key={ex} className="px-3 py-1 bg-destructive/10 text-destructive text-xs font-medium rounded-full">
                          {ex}
                        </span>
                      ))}
                    </div>
                 </div>
              </div>
            ) : (
              <p className="mb-8">Analyzing...</p>
            )}

            <div className="flex justify-end">
              {compressionDone ? (
                <div className="flex items-center text-green-500 font-semibold space-x-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Compression Complete!</span>
                </div>
              ) : (
                <button onClick={handleCompress} disabled={isCompressing || !analysis} className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center space-x-2 shadow-lg shadow-primary/20">
                  <Play className="w-5 h-5" fill="currentColor" />
                  <span>{isCompressing ? 'Compressing...' : 'Start Compression'}</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* Hidden browser folder upload input */}
      <input
        type="file"
        id="folder-input"
        className="hidden"
        multiple
        onChange={handleBrowserFolderSelect}
        {...{
          webkitdirectory: "",
          directory: ""
        }}
      />
    </div>
  );
}

export default App;

