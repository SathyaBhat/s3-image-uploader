import { useState, useEffect } from "react";
import {
  ListObjectsV2Command,
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import FileList from "./components/FileList";
import UploadZone from "./components/UploadZone";
import {
  FaSortAmountDown,
  FaSortAmountUp,
  FaCopy,
  FaCheck,
} from "react-icons/fa";

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

function App() {
  const [currentPrefix, setCurrentPrefix] = useState("sb/weekly-notes/");
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [copiedField, setCopiedField] = useState(null);

  const fetchObjects = async (prefix = "") => {
    try {
      setLoading(true);
      const command = new ListObjectsV2Command({
        Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
        Prefix: prefix,
        Delimiter: "/",
      });

      const response = await s3Client.send(command);

      // Combine CommonPrefixes (folders) and Contents (files)
      const folders = (response.CommonPrefixes || []).map((prefix) => ({
        ...prefix,
        isFolder: true,
      }));

      const files = (response.Contents || [])
        .filter((item) => item.Key !== prefix)
        .map((item) => ({
          ...item,
          isFolder: false,
        }));

      setObjects([...folders, ...files]);
    } catch (error) {
      console.error("Error fetching objects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjects(currentPrefix);
  }, [currentPrefix]);

  const handleFolderClick = (prefix) => {
    setCurrentPrefix(prefix);
    setCurrentPage(1);
  };

  const handleBack = () => {
    const newPrefix = currentPrefix.split("/").slice(0, -2).join("/") + "/";
    setCurrentPrefix(newPrefix === "/" ? "" : newPrefix);
    setCurrentPage(1);
  };

  const handleRename = async (oldKey, newKey) => {
    try {
      // Copy the object to the new key
      const copyCommand = new CopyObjectCommand({
        Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
        CopySource: `${import.meta.env.VITE_AWS_BUCKET_NAME}/${oldKey}`,
        Key: newKey,
      });
      await s3Client.send(copyCommand);

      // Delete the old object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
        Key: oldKey,
      });
      await s3Client.send(deleteCommand);

      // Refresh the file list
      fetchObjects(currentPrefix);
    } catch (error) {
      console.error("Error renaming file:", error);
      throw error;
    }
  };

  const handleFileClick = (file) => {
    if (!file.isFolder) {
      setSelectedFile({
        name: file.Key.slice(currentPrefix.length),
        url: `https://i.sathyabh.at/${file.Key}`,
      });
    }
  };

  const sortedObjects = [...objects].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    if (sortOrder === "desc") {
      return new Date(b.LastModified) - new Date(a.LastModified);
    }
    return new Date(a.LastModified) - new Date(b.LastModified);
  });

  const totalPages = Math.ceil(sortedObjects.length / itemsPerPage);
  const paginatedObjects = sortedObjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1>S3 File Browser</h1>
        <div className="header-controls">
          {currentPrefix && (
            <button onClick={handleBack} className="back-button">
              ← Back
            </button>
          )}
          <div className="current-path">
            Current path: {currentPrefix || "root"}
          </div>
        </div>
      </header>

      <div className="main-content">
        <div className="content-left">
          <UploadZone
            currentPrefix={currentPrefix}
            onUploadComplete={() => fetchObjects(currentPrefix)}
          />

          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              <div className="list-controls">
                <div className="sort-controls">
                  <button
                    className="icon-button"
                    onClick={toggleSortOrder}
                    title={`Sort by date ${sortOrder === "desc" ? "ascending" : "descending"}`}
                  >
                    {sortOrder === "desc" ? (
                      <FaSortAmountDown />
                    ) : (
                      <FaSortAmountUp />
                    )}
                  </button>
                </div>
                <div className="pagination-controls">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                  <div className="pagination-buttons">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <span>
                      {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <FileList
                objects={paginatedObjects}
                onFolderClick={handleFolderClick}
                currentPrefix={currentPrefix}
                onRename={handleRename}
                onFileClick={handleFileClick}
              />
            </>
          )}
        </div>

        {selectedFile && (
          <div className="preview-pane">
            <h3>{selectedFile.name}</h3>
            <div className="preview-image-container">
              <img
                src={selectedFile.url}
                alt={selectedFile.name}
                className="preview-image"
              />
            </div>
            <div className="preview-details">
              <div className="preview-field">
                <label>File name</label>
                <div className="copy-field">
                  <input
                    type="text"
                    value={selectedFile.name}
                    readOnly
                    onClick={() =>
                      copyToClipboard(selectedFile.name, "filename")
                    }
                  />
                  <button
                    className="copy-button"
                    onClick={() =>
                      copyToClipboard(selectedFile.name, "filename")
                    }
                    title="Copy filename"
                  >
                    {copiedField === "filename" ? <FaCheck /> : <FaCopy />}
                  </button>
                </div>
              </div>
              <div className="preview-field">
                <label>URL</label>
                <div className="copy-field">
                  <input
                    type="text"
                    value={selectedFile.url}
                    readOnly
                    onClick={() => copyToClipboard(selectedFile.url, "url")}
                  />
                  <button
                    className="copy-button"
                    onClick={() => copyToClipboard(selectedFile.url, "url")}
                    title="Copy URL"
                  >
                    {copiedField === "url" ? <FaCheck /> : <FaCopy />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

