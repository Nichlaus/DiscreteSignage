export function mountInteractiveAccess(root, business, call, reload, escape) {
  const access = business.interactiveAccess;
  if (!access) return;
  const section = document.createElement('section'); root.append(section);
  section.innerHTML = '<h3>Interactive AI access</h3><p>Current: '+escape(access.state)+
    (access.expiresAt ? ' · expires '+escape(new Date(access.expiresAt).toLocaleString()) : '')+
    '</p><p>This controls the add-on only. Active signage access is still required. No billing or camera permission is changed.</p>';
  if (!business.canManageInteractive) { section.insertAdjacentHTML('beforeend','<p>Interactive access management permission is required to change this.</p>'); return; }
  section.insertAdjacentHTML('beforeend',`<form><label>Access<select name="state"><option value="inherit">Use trial access</option><option value="enabled">Enable until expiry</option><option value="disabled">Disable</option></select></label>
    <label>Expiry (your browser time zone)<input type="datetime-local" name="expiry"></label>
    <label>Reason<input name="reason" required minlength="5" maxlength="300"></label>
    <button>Save interactive access</button><p role="status"></p></form>`);
  const form=section.querySelector('form'), state=form.elements.state, expiry=form.elements.expiry, status=form.querySelector('[role="status"]');
  state.value=access.state;
  if(access.expiresAt) { const d=new Date(access.expiresAt); expiry.value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
  const update=()=>{expiry.disabled=state.value!=='enabled'; expiry.required=state.value==='enabled';}; state.onchange=update; update();
  form.onsubmit=async event=>{
    event.preventDefault(); if(!form.reportValidity())return;
    const data={businessId:business.id,state:state.value,expiresAt:state.value==='enabled'?new Date(expiry.value).getTime():null,expectedVersion:access.version,reason:form.elements.reason.value.trim()};
    form.querySelector('button').disabled=true;status.textContent='Saving…';
    try {await call(data);reload();} catch(error) {status.textContent=error.message || 'Could not save. Reload diagnostics and retry.';form.querySelector('button').disabled=false;}
  };
}
