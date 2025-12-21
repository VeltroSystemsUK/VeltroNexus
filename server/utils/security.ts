/**
 * Sanitize a filename to prevent header injection attacks in Content-Disposition headers.
 * Removes or escapes characters that could be used for header injection or path traversal.
 * 
 * @param filename - The original filename
 * @returns A sanitized filename safe for use in Content-Disposition headers
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'download';
  
  // Remove path components (prevent path traversal)
  let sanitized = filename.replace(/^.*[\\\/]/, '');
  
  // Remove or replace dangerous characters:
  // - CR/LF (header injection)
  // - Quotes (break out of quoted strings)
  // - Semicolons (could add extra parameters)
  // - Null bytes
  // - Control characters
  sanitized = sanitized
    .replace(/[\r\n\0]/g, '') // Remove CR, LF, null
    .replace(/["\';]/g, '_')  // Replace quotes and semicolons
    .replace(/[<>|?*:]/g, '_') // Replace filesystem dangerous chars
    .replace(/\.\./g, '_')     // Prevent directory traversal
    .replace(/[\x00-\x1f\x7f]/g, ''); // Remove control characters
  
  // Ensure filename is not empty after sanitization
  if (!sanitized || sanitized.trim() === '') {
    return 'download';
  }
  
  // Limit length to prevent potential buffer issues
  if (sanitized.length > 255) {
    const ext = sanitized.lastIndexOf('.');
    if (ext > 0) {
      const extension = sanitized.substring(ext);
      sanitized = sanitized.substring(0, 255 - extension.length) + extension;
    } else {
      sanitized = sanitized.substring(0, 255);
    }
  }
  
  return sanitized;
}

/**
 * Check if a buffer contains SVG content by inspecting magic bytes and content patterns.
 * SVG files can be disguised with different extensions (e.g., .png) but still execute JS.
 * 
 * @param buffer - The file buffer to check (first 1KB is sufficient)
 * @returns true if the content appears to be SVG
 */
export function isSvgContent(buffer: Buffer): boolean {
  if (!buffer || buffer.length === 0) return false;
  
  // Check first 1KB of content
  const sampleSize = Math.min(buffer.length, 1024);
  const sample = buffer.subarray(0, sampleSize).toString('utf8').toLowerCase();
  
  // Strip whitespace/BOM from start for detection
  const trimmed = sample.replace(/^\ufeff/, '').trim();
  
  // SVG detection patterns
  const svgPatterns = [
    /^<\?xml[^>]*\?>\s*<svg/i,  // XML declaration followed by SVG
    /^<svg[\s>]/i,               // Direct SVG start
    /<!doctype\s+svg/i,          // SVG doctype
    /<svg[^>]*xmlns/i,           // SVG with namespace
  ];
  
  return svgPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Validate image magic bytes to ensure file content matches claimed type.
 * Returns true if content matches a known safe image format.
 * 
 * @param buffer - The file buffer to check
 * @returns true if the content has valid image magic bytes
 */
export function hasValidImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return true;
  }
  
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }
  
  // GIF: 47 49 46 38 (GIF8)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return true;
  }
  
  // WebP: RIFF....WEBP
  if (buffer.length >= 12 && 
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return true;
  }
  
  return false;
}

/**
 * Encode a filename for use in Content-Disposition header using RFC 5987 encoding.
 * This properly handles non-ASCII characters.
 * 
 * @param filename - The sanitized filename
 * @returns A properly encoded Content-Disposition value
 */
export function encodeContentDisposition(filename: string): string {
  const sanitized = sanitizeFilename(filename);
  
  // Check if ASCII-only (simple case)
  const isAscii = /^[\x20-\x7e]+$/.test(sanitized);
  
  if (isAscii) {
    // For ASCII filenames, just use the simple quoted format
    return `attachment; filename="${sanitized}"`;
  } else {
    // For non-ASCII, use RFC 5987 encoding with fallback
    const encoded = encodeURIComponent(sanitized).replace(/'/g, '%27');
    return `attachment; filename="${sanitized.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encoded}`;
  }
}
