import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, FileText, Image, File, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

type KBFile = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  status: string;
  created_at: string;
};

type Server = {
  id: string;
  name: string;
  discord_guild_id: string;
};

const KnowledgeBase = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serverIdParam = searchParams.get("server_id");

  const [session, setSession] = useState<any>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(serverIdParam);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Initialize session and load servers
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }
      setSession(session);

      // Get user's discord_user_id
      const { data: userRow } = await supabase
        .from("users")
        .select("discord_user_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (userRow?.discord_user_id) {
        // Fetch servers the user has access to
        const { data: userServerMappings } = await supabase
          .from("user_servers")
          .select("discord_server_id")
          .eq("discord_user_id", userRow.discord_user_id);

        if (userServerMappings && userServerMappings.length > 0) {
          const serverIds = userServerMappings.map(m => m.discord_server_id);
          const { data: serversData } = await supabase
            .from("servers")
            .select("id, name, discord_guild_id")
            .in("discord_guild_id", serverIds);

          setServers(serversData || []);

          // Set selected server
          if (serverIdParam) {
            const found = serversData?.find(s => s.id === serverIdParam);
            if (found) {
              setSelectedServerId(found.id);
              setSelectedServer(found);
            }
          } else if (serversData && serversData.length > 0) {
            setSelectedServerId(serversData[0].id);
            setSelectedServer(serversData[0]);
          }
        }
      }

      setLoading(false);
    };

    init();
  }, [navigate, serverIdParam]);

  // Update selected server when selection changes
  useEffect(() => {
    if (selectedServerId && servers.length > 0) {
      const found = servers.find(s => s.id === selectedServerId);
      setSelectedServer(found || null);
    }
  }, [selectedServerId, servers]);

  // Load files for selected server
  const loadFiles = useCallback(async () => {
    if (!selectedServer) return;

    const { data, error } = await supabase
      .from("server_kb_files")
      .select("*")
      .eq("discord_server_id", selectedServer.discord_guild_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading files:", error);
    } else {
      setFiles(data || []);
    }
  }, [selectedServer]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !session || !selectedServer) return;

    setUploading(true);

    for (const file of Array.from(fileList)) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp"
      ];

      if (!allowedTypes.includes(file.type)) {
        alert(`File type not supported: ${file.name}`);
        continue;
      }

      // Generate unique path
      const fileExt = file.name.split(".").pop() || "bin";
      const uniqueId = crypto.randomUUID();
      const filePath = `${selectedServer.discord_guild_id}/${uniqueId}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("kb-files")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert(`Failed to upload ${file.name}: ${uploadError.message}`);
        continue;
      }

      // Insert metadata
      const { error: metaError } = await supabase
        .from("server_kb_files")
        .insert({
          discord_server_id: selectedServer.discord_guild_id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          status: "uploaded"
        });

      if (metaError) {
        console.error("Metadata error:", metaError);
        // Try to clean up the uploaded file
        await supabase.storage.from("kb-files").remove([filePath]);
        alert(`Failed to save metadata for ${file.name}`);
      }
    }

    setUploading(false);
    loadFiles();
  };

  const handleDelete = async (file: KBFile) => {
    if (!confirm(`Delete "${file.file_name}"?`)) return;

    setDeleting(file.id);

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("kb-files")
      .remove([file.file_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
    }

    // Delete metadata
    const { error: metaError } = await supabase
      .from("server_kb_files")
      .delete()
      .eq("id", file.id);

    if (metaError) {
      console.error("Metadata delete error:", metaError);
      alert("Failed to delete file metadata");
    }

    setDeleting(null);
    loadFiles();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "")) {
      return <Image className="w-5 h-5 text-purple-400" />;
    }
    if (ext === "pdf") {
      return <FileText className="w-5 h-5 text-red-400" />;
    }
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      uploaded: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      indexing: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      ready: "bg-green-500/20 text-green-300 border-green-500/30",
      error: "bg-red-500/20 text-red-300 border-red-500/30"
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[status] || colors.uploaded}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-[#5865F2] border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-white">
      <div className="relative min-h-screen overflow-hidden">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(88,101,242,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,255,182,0.2),_transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(to_right,_rgba(255,255,255,0.08)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(255,255,255,0.08)_1px,_transparent_1px)] bg-[size:80px_80px]" />

        <div className="relative z-10 flex flex-col min-h-screen px-6 py-6 md:px-10 md:py-8 space-y-6">
          {/* Header */}
          <header className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-4 md:px-6 py-3 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.6)]">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#5865F2] to-[#3BFFB6] flex items-center justify-center text-sm font-bold">
                G
              </div>
              <span className="font-semibold tracking-wide">Knowledge Base</span>
            </div>

            <div className="flex items-center gap-4">
              <select
                className="bg-white/5 border border-white/20 rounded-xl px-3 py-1.5 text-sm text-gray-200"
                value={selectedServerId || ""}
                onChange={(e) => setSelectedServerId(e.target.value)}
              >
                {servers.length === 0 && (
                  <option value="">No servers</option>
                )}
                {servers.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name}
                  </option>
                ))}
              </select>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Upload Area */}
            <div
              className={`backdrop-blur-xl bg-white/5 border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                dragActive ? "border-[#5865F2] bg-[#5865F2]/10" : "border-white/20"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">
                {uploading ? "Uploading..." : "Drop files here or click to upload"}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Supports PDF, TXT, MD, PNG, JPG, GIF, WEBP
              </p>
              <label className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#5865F2] hover:bg-[#6b74ff] cursor-pointer transition">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  disabled={uploading || !selectedServer}
                />
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Select Files"
                )}
              </label>
            </div>

            {/* File List */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="font-semibold">Uploaded Files</h2>
                <p className="text-sm text-gray-400">
                  {files.length} file{files.length !== 1 ? "s" : ""} for {selectedServer?.name || "selected server"}
                </p>
              </div>

              {files.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No files uploaded yet</p>
                  <p className="text-sm">Upload PDFs, images, or text files to build your knowledge base</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-4">
                        {getFileIcon(file.file_name)}
                        <div>
                          <p className="font-medium">{file.file_name}</p>
                          <p className="text-sm text-gray-400">
                            {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {getStatusBadge(file.status)}
                        <button
                          onClick={() => handleDelete(file)}
                          disabled={deleting === file.id}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition text-gray-400 hover:text-red-400 disabled:opacity-50"
                        >
                          {deleting === file.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
