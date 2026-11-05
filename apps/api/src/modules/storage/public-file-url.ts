export function publicFileUrl(fileId: string | null | undefined) {
  return fileId ? `/api/v1/files/${fileId}` : null;
}
