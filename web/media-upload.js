// Do not persist or log the upload URL: it is a short-lived write credential.
export function uploadMedia(file, grant, progress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', grant.url);
    xhr.timeout = 5 * 60000;
    for (const [name, value] of Object.entries(grant.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) progress(Math.floor(100 * event.loaded / event.total));
    };
    xhr.onload = () => {
      // A previous attempt may have completed despite losing its response.
      // Completion still checks the object's exact size, type and signature.
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 412) resolve();
      else reject(new Error('Upload failed. Retry with the file, or confirm it if it already finished.'));
    };
    xhr.onerror = xhr.ontimeout = () => reject(new Error('Upload interrupted. Retry with the file, or confirm it if it already finished.'));
    xhr.send(file);
  });
}
