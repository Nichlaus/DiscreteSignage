export function screenHelpView() {
  return `<details><summary>Screen setup, offline playback and restarting</summary>
    <h4>Connect your screen</h4>
    <p>Open Discrete Signage Display on Android, or open the browser display page. The business owner can choose Pair a display in this portal and enter the code shown on that screen. Add validated media, save the playlist, then refresh screen status to check for Applied.</p>
    <h4>If the internet drops</h4>
    <p>The current Android app downloads the eligible playlist before playing. Keep the app open: downloaded playback can continue for up to 24 hours from its last successful authorization. It stops sooner if your trial ends or a schedule changes. Browser displays need a continuous connection and stop when their short authorization expires.</p>
    <p>Offline screens cannot receive playlist changes or revocations until they reconnect. Playback reports may be incomplete. When offline authorization ends, the Android app clears both regions and the logo; reconnect it to resume eligible content.</p>
    <h4>After restarting</h4>
    <p>Android needs internet to authorize playback again, even when files are already downloaded. It retries automatically when the connection returns.</p>
    <p>For automatic startup, open Display settings on the device → Set up startup after reboot, then choose Discrete Signage as its Home app. This also makes the Home button return to signage. To undo it, choose your previous Home app in the same settings. Unlocking may still be required, and some TVs do not support changing Home.</p>
    <h4>Open settings on Android</h4>
    <p>During playback, hold OK on the remote, press Menu, or touch and hold the screen. Startup setup is local to the device; this portal cannot change its Home app. Check playback on the screen itself after setup—Applied is a recent acknowledgement, not proof that customers can see it.</p>
  </details>`;
}
