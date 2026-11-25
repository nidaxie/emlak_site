export function publicFileUrl(fileId: string | null | undefined) {
  return fileId ? `/api/v1/files/${fileId}` : null;
}

export function agentOwnedFileUrl(fileId: string | null | undefined) {
  return fileId ? `/api/v1/properties/me/files/${fileId}` : null;
}

export function agentOwnedLogoUrl(fileId: string | null | undefined) {
  return fileId ? `/api/v1/agents/me/files/${fileId}` : null;
}

export function userOwnedFileUrl(fileId: string | null | undefined) {
  return fileId ? `/api/v1/user-properties/me/files/${fileId}` : null;
}
