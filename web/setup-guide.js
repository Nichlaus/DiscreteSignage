export function setupGuide(workspace, checkedAt) {
  if (workspace.role !== 'owner') return '';
  const firstScreen = !(workspace.screens ?? []).some(screen => screen.active);
  const open = firstScreen && workspace.trialEndsAt > checkedAt;
  return `<details class="setup-guide" ${open ? 'open' : ''}><summary>Get your first screen playing</summary>
    <p>Start with one screen and one image. You can add videos, layouts and schedules once that works.</p>
    <ol>
      <li><strong>Check your location.</strong> Confirm the branch and time zone under <a href="#locations-section">Locations</a>. Advert schedules use that location’s time zone.</li>
      <li><strong>Connect the display.</strong> Open Discrete Signage Display on Android, or <a href="/display.html" target="_blank" rel="noopener">open the browser player</a> on the screen. Keep it online, then <a href="#pair-display" data-screen-jump>enter its pairing code</a> here and choose the location. Codes expire after ten minutes.</li>
      <li><strong>Prepare your first image.</strong> In the <a href="#media-section">media library</a>, upload a JPEG, PNG or WebP up to 20 MiB. Choose Check for playback and wait for Ready for screens. If it fails, read the file’s message and try a supported image.</li>
      <li><strong>Save a playlist.</strong> Under <a href="#screens-section">Screens</a>, open the paired screen’s settings. Add the ready image to Playlist 1, leave the layout as one region and save. If the image is missing, refresh the library.</li>
      <li><strong>Check the actual screen.</strong> Refresh screen status and look for Applied, then confirm the image is visible on the display. Applied alone does not prove visible playback. For connection or restart problems, open Screen setup, offline playback and restarting under Screens.</li>
    </ol>
    <p class="field-note">This guide does not mark steps complete automatically. Physical-device compatibility still needs testing for your installation. POS, ordering and interactive AI are planned for later releases.</p>
  </details>`;
}
