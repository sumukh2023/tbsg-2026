/**
 * Putting the attachment where the server told us to put it.
 *
 * TWO STEPS, AND THE BYTES DO NOT PASS THROUGH OUR API. `/api/partner-interest
 * ?action=upload` hands back a one-off signed URL, and the file goes straight
 * from the browser to Supabase Storage. That is not an optimisation: a Vercel
 * serverless function takes a 4.5 MB request body, and the brief asks for
 * 10 MB documents, so a file routed through the function could not be sent at
 * the required size at all.
 *
 * What comes back is a path and a token, not a URL. The token is the server's
 * own signature over the path; handing it back at submit is how the form
 * proves it is attaching an object this server issued a place for, rather
 * than naming one it would like to claim.
 *
 * XMLHttpRequest rather than fetch, for one reason: fetch cannot report
 * upload progress. A 10 MB deck on an Indian mobile connection is long enough
 * that a form with no progress bar looks broken.
 */

export type UploadedDocument = {
  path: string;
  token: string;
  name: string;
};

type Ticket = {
  upload_url: string;
  path: string;
  token: string;
  content_type: string;
};

/** Thrown with a sentence meant for the person who chose the file. */
class UploadError extends Error {}

export async function uploadDocument(
  file: File,
  onProgress: (fraction: number) => void
): Promise<UploadedDocument> {
  const response = await fetch('/api/partner-interest?action=upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, size: file.size }),
  });
  const ticket = (await response.json().catch(() => null)) as
    | (Ticket & { error?: string })
    | null;

  if (!response.ok || !ticket?.upload_url) {
    throw new UploadError(
      ticket?.error ?? 'We could not prepare the upload. Please try again.'
    );
  }

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', ticket.upload_url, true);
    // The type the SERVER derived from the extension, not the one the browser
    // guessed. The bucket only accepts the five real document types, and
    // browsers report .doc and .ppt as application/octet-stream often enough
    // that sending the browser's guess would fail the upload for real files.
    request.setRequestHeader('Content-Type', ticket.content_type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      reject(
        new UploadError(
          request.status === 413
            ? 'That file is larger than the 10 MB limit.'
            : 'The attachment could not be uploaded. Please try again.'
        )
      );
    };
    request.onerror = () =>
      reject(
        new UploadError(
          'The attachment could not be uploaded. Please check your connection.'
        )
      );
    request.onabort = () =>
      reject(new UploadError('The upload was interrupted.'));
    request.send(file);
  });

  return { path: ticket.path, token: ticket.token, name: file.name };
}

/** A sentence safe to show, whatever went wrong. */
export function uploadMessage(cause: unknown): string {
  return cause instanceof UploadError
    ? cause.message
    : 'The attachment could not be uploaded. Please try again.';
}
