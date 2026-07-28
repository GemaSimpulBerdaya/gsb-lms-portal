import { UTApi } from "uploadthing/server";

export function uploadThingKey(fileUrl: string | undefined): string | null {
  if (!fileUrl) return null;
  try {
    const url = new URL(fileUrl);
    return url.hostname === "ufs.sh" || url.hostname.endsWith(".ufs.sh")
      ? url.pathname.replace(/^\//, "") || null
      : null;
  } catch {
    return null;
  }
}

export async function deleteUploadThingFile(fileUrl: string | undefined): Promise<void> {
  const key = uploadThingKey(fileUrl);
  if (!key) return;
  await new UTApi().deleteFiles(key);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
