import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

/**
 * Universal File Upload Hook for Cloudflare R2 / Elite ERP
 * Standardized across Chat, Task Manager, Digital Prints, and Modals.
 */
export function useFileUpload(defaultOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const hiddenInputRef = useRef(null);

  /**
   * Validate and sanitize file before upload
   */
  const validateFile = useCallback((file, options = {}) => {
    if (!file) throw new Error('No file provided');
    const lowerName = (file.name || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();

    // Enforce TIFF exclusion policy
    if (lowerName.endsWith('.tif') || lowerName.endsWith('.tiff') || mime === 'image/tiff' || mime === 'image/tif') {
      throw new Error('TIFF files (.tif, .tiff) are not allowed. Please upload JPG, PNG, WEBP, or standard document formats.');
    }

    // Enforce forbidden executable and binary extensions
    const FORBIDDEN_EXTENSIONS = [
      '.exe', '.bat', '.cmd', '.sh', '.bash', '.php', '.phtml',
      '.cgi', '.pl', '.py', '.vbs', '.msi', '.jar', '.scr', '.html', '.htm',
      '.bin', '.dll', '.so', '.com'
    ];
    const ext = '.' + (lowerName.split('.').pop() || '');
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      throw new Error(`File type ${ext} is blocked for security reasons. Executable and raw binary files cannot be uploaded.`);
    }

    // Dynamic size limit: 10MB for chat / custom maxSizeMB, otherwise 100MB standard limit
    const isChat = options.useChatEndpoint || (options.folder && options.folder.startsWith('Chat'));
    const maxLimit = options.maxSizeMB
      ? options.maxSizeMB * 1024 * 1024
      : (isChat ? 10 * 1024 * 1024 : 100 * 1024 * 1024);

    if (file.size > maxLimit) {
      const limitMb = Math.round(maxLimit / (1024 * 1024));
      throw new Error(`File size exceeds maximum allowable limit of ${limitMb}MB (selected: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
    }

    return true;
  }, []);

  /**
   * Detect standardized file type
   */
  const getFileType = useCallback((file) => {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(name)) return 'image';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(name)) return 'audio';
    if (/\.(xls|xlsx|csv)$/i.test(name)) return 'spreadsheet';
    if (/\.(doc|docx|txt|rtf|md|markdown|json)$/i.test(name)) return 'document';
    if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'archive';
    return 'file';
  }, []);

  /**
   * Upload a single file
   */
  const uploadFile = useCallback(async (file, options = {}) => {
    const opts = { ...defaultOptions, ...options };
    validateFile(file, opts);

    setIsUploading(true);
    setProgress(10);
    setError(null);

    try {
      const originalInputFileName = file?.name || '';
      let fileToUpload = file;
      const fileType = getFileType(file);

      // Compress large images if enabled
      if (fileType === 'image' && opts.compress !== false && !file.name?.toLowerCase().endsWith('.svg')) {
        try {
          const imageCompressionModule = await import('browser-image-compression');
          const imageCompression = imageCompressionModule.default || imageCompressionModule;
          const compressedBlob = await imageCompression(file, {
            maxSizeMB: opts.maxSizeMB || 2,
            maxWidthOrHeight: opts.maxWidthOrHeight || 2560,
            useWebWorker: true
          });
          // Re-wrap compressed Blob into a File object with original name preserved
          fileToUpload = new File([compressedBlob], originalInputFileName || 'image.png', {
            type: compressedBlob.type || file.type || 'image/png'
          });
        } catch (compressionErr) {
          console.warn('[useFileUpload] Image compression skipped/failed:', compressionErr);
          fileToUpload = file;
        }
      }

      setProgress(40);
      const folder = opts.folder || 'uploads';
      let res;

      // Use Chat attachment route or workspace upload
      if (opts.useChatEndpoint) {
        res = await api.uploadChatAttachment(fileToUpload, folder);
      } else {
        // Direct to /workspace/upload or /upload
        const formData = new FormData();
        formData.append('file', fileToUpload, originalInputFileName || fileToUpload.name);
        formData.append('folder', folder);

        res = await api.request('/workspace/upload', {
          method: 'POST',
          body: formData
        }).catch(async (err) => {
          // Fallback to /upload
          return await api.uploadImage(fileToUpload, folder);
        });
      }

      setProgress(90);

      const fileUrl = res?.fileUrl || res?.url || (res?.data && (res.data.fileUrl || res.data.url));
      if (!fileUrl) {
        throw new Error(res?.message || 'Server did not return a valid file URL.');
      }

      const fileInfo = {
        fileName: res?.fileName || res?.originalName || originalInputFileName || file.name,
        originalName: res?.originalName || originalInputFileName || file.name,
        fileUrl,
        fileSize: res?.fileSize || fileToUpload.size || file.size,
        fileType,
        mimeType: file.type || 'application/octet-stream',
        folder: res?.folder || folder
      };

      setUploadedFiles((prev) => [...prev, fileInfo]);
      setProgress(100);
      return fileInfo;
    } catch (err) {
      console.error('[useFileUpload] Upload failed:', err);
      setError(err.message || 'File upload failed');
      throw err;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [defaultOptions, validateFile, getFileType]);

  /**
   * Upload multiple files sequentially or in parallel
   */
  const uploadMultiple = useCallback(async (fileList, options = {}) => {
    const files = Array.from(fileList || []);
    if (!files.length) return [];

    setIsUploading(true);
    setError(null);
    const results = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(Math.round(((i + 1) / files.length) * 100));
        const res = await uploadFile(files[i], options);
        results.push(res);
      }
      return results;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [uploadFile]);

  /**
   * Helper to trigger native file dialog
   */
  const openFileDialog = useCallback(({
    accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,audio/*',
    multiple = false,
    onSelect
  } = {}) => {
    let input = hiddenInputRef.current;
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';
      document.body.appendChild(input);
      hiddenInputRef.current = input;
    }

    input.accept = accept;
    input.multiple = multiple;
    input.value = '';

    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      if (onSelect) {
        onSelect(multiple ? files : files[0]);
      }
    };

    input.click();
  }, []);

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
    setUploadedFiles([]);
  }, []);

  return {
    isUploading,
    progress,
    error,
    uploadedFiles,
    uploadFile,
    uploadMultiple,
    openFileDialog,
    reset,
    validateFile,
    getFileType
  };
}

export default useFileUpload;
