import { saveAs } from 'file-saver';

/**
 * Supported document formats and their MIME types
 */
export const SUPPORTED_FORMATS = {
  // PDF
  'application/pdf': ['.pdf'],
};

/**
 * Get all supported file extensions
 */
export const getSupportedExtensions = (): string[] => {
  const extensions = new Set<string>();
  Object.values(SUPPORTED_FORMATS).forEach(exts => {
    exts.forEach(ext => extensions.add(ext));
  });
  return Array.from(extensions);
};

/**
 * Validate if file is a supported document format
 */
export const validatePdfFile = (file: File): { isValid: boolean; error?: string } => {
  // Get file extension
  const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
  const supportedExts = getSupportedExtensions();

  // Check if extension is supported
  if (!supportedExts.includes(fileExt)) {
    return {
      isValid: false,
      error: `Unsupported file format. Supported formats: ${supportedExts.join(', ')}`,
    };
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size must be less than 10MB.',
    };
  }

  return { isValid: true };
};

/**
 * Validate document file (alias for backward compatibility)
 */
export const validateDocumentFile = validatePdfFile;



/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Download base64 file
 */
export const downloadBase64File = (base64Data: string, filename: string): void => {
  try {
    // Convert base64 to blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    // Use file-saver to download
    saveAs(blob, filename);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw new Error('Failed to download file');
  }
};

/**
 * Get file extension
 */
export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

/**
 * Generate safe filename
 */
export const generateSafeFilename = (originalName: string, suffix: string = ''): string => {
  // Remove extension
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
  
  // Replace unsafe characters
  const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  return `${safeName}${suffix}`;
};
