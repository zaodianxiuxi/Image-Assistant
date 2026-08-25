export const MAX_REFERENCE_IMAGES = 10;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function hasUploadSizeWithinLimit(files) {
  return files.reduce((total, file) => total + file.size, 0) <= MAX_UPLOAD_BYTES;
}
