export interface PhotoFileLike {
  name?: string | null;
  createdTime?: string | null;
  imageMediaMetadata?: { time?: string | null } | null;
}

// EXIF time ("2026:03:14 13:11:28") is the local time the photo was taken; camera filenames
// (PXL_20260314_131128000.jpg) are the fallback; upload time is the last resort.
export function photoTakenDay(file: PhotoFileLike): string | undefined {
  const exif = file.imageMediaMetadata?.time?.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
  if (exif) return `${exif[1]}-${exif[2]}-${exif[3]}`;

  const fromName = file.name?.match(/(?:^|\D)(20\d{2})(\d{2})(\d{2})[_-]/);
  if (fromName) return `${fromName[1]}-${fromName[2]}-${fromName[3]}`;

  return file.createdTime?.slice(0, 10) || undefined;
}
