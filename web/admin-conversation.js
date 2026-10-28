export function mountConversationSettings(root, call) {
  root.innerHTML = `<h2>Customer AI conversation</h2>
    <p>These settings affect every business. Request limits control usage; they are not a dollar spending cap. Failed requests count. Daily limits reset at midnight UTC.</p>
    <button type="button">Load conversation controls</button><p role="status"></p><div></div>`;
  const load = root.querySelector('button'), status = root.querySelector('[role="status"]'), area = root.querySelector('div');
  load.onclick = async () => {
    load.disabled = true; status.textContent = 'Loading…'; area.replaceChildren();
    try {
      const config = await call('getConversationSettings', {});
      area.innerHTML = `<form><label>Conversation service<select name="enabled"><option value="false">Off</option><option value="true">On</option></select></label>
        <label>Requests per business per day<input type="number" name="businessDaily" min="1" max="500" required></label>
        <label>Total requests per business<input type="number" name="businessTotal" min="1" max="5000" required></label>
        <label>Requests across all businesses per day<input type="number" name="globalDaily" min="1" max="5000" required></label>
        <label>Reason for change<input name="reason" minlength="5" maxlength="300" required></label>
        <button type="submit">Save conversation controls</button></form>`;
      const form = area.querySelector('form');
      form.elements.enabled.value = String(config.enabled);
      for (const key of ['businessDaily', 'businessTotal', 'globalDaily']) form.elements[key].value = config[key];
      status.textContent = config.enabled ? 'Conversation service is on.' : 'Conversation service is off.';
      form.onsubmit = async event => {
        event.preventDefault(); if (!form.reportValidity()) return;
        const button = form.querySelector('button'); button.disabled = true; status.textContent = 'Saving…';
        try {
          await call('setConversationSettings', { enabled:form.elements.enabled.value === 'true',
            businessDaily:Number(form.elements.businessDaily.value), businessTotal:Number(form.elements.businessTotal.value),
            globalDaily:Number(form.elements.globalDaily.value), expectedVersion:config.version, reason:form.elements.reason.value.trim() });
          await load.onclick();
        } catch { status.textContent = 'Could not save. Reload the controls and try again.'; }
        finally { button.disabled = false; }
      };
    } catch { status.textContent = 'Could not load controls. Conversation management permission and MFA are required.'; }
    finally { load.disabled = false; }
  };
}
