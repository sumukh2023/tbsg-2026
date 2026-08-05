/**
 * What may be attached to a sponsor Expression of Interest.
 *
 * THIS IS A COPY, NOT THE RULE. api/_storage.ts is the authority: it checks
 * every one of these again, and it checks the file that ACTUALLY landed in
 * the bucket rather than what the browser said it was sending. This copy
 * exists so nobody waits for a round trip and a 10 MB upload to be told their
 * .zip was never going to be accepted.
 */

export const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx'] as const;

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Extensions people reach for that are worth naming in the refusal. */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'dll', 'sh', 'app', 'apk',
  'jar', 'ps1', 'vbs', 'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'iso', 'dmg',
]);

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** null when the file is fine; otherwise the sentence to show. */
export function checkDocument(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_EXTENSIONS.has(extension)) {
    return 'Programs and archives cannot be attached. Please choose a PDF, Word or PowerPoint document.';
  }
  const accepted: readonly string[] = ACCEPTED_EXTENSIONS;
  if (!accepted.includes(extension)) {
    return 'That file type is not accepted. Please choose a PDF, Word or PowerPoint document.';
  }
  if (file.size <= 0) return 'That file looks empty.';
  if (file.size > MAX_DOCUMENT_BYTES) {
    return `That file is ${humanSize(file.size)}. The limit is 10 MB.`;
  }
  return null;
}
