(function () {
  'use strict';
  const root = document.getElementById('psi-boost-website-test');
  const engine = window.BoostWebsiteTest;
  const el = id => root.querySelector('#' + id);
  let state = engine.createSession();
  const clock = stamp => new Date(stamp).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  function remember() {
    const host = window.openai;
    if (host && typeof host.setWidgetState === 'function') {
      Promise.resolve(host.setWidgetState({ modelContent: { testOnly: true, intent: state.intent, handoff: state.queued }, privateContent: { mode: state.mode, open: state.open } })).catch(() => {});
    }
  }
  function restore(globals) {
    const saved = globals && globals.widgetState && globals.widgetState.privateContent;
    if (saved && typeof saved.open === 'boolean') state.open = saved.open;
    if (saved && ['customer', 'inbox'].includes(saved.mode)) state.mode = saved.mode;
    render();
  }
  function messages(target) {
    target.replaceChildren();
    state.messages.forEach(message => {
      const item = document.createElement('article');
      item.className = 'boost-message ' + message.role;
      const byline = document.createElement('p');
      byline.className = 'boost-byline';
      byline.textContent = message.role === 'visitor' ? 'Test visitor' : message.role === 'matt' ? 'Matt · Test reply' : 'Boost · Draft FAQ';
      const bubble = document.createElement('div');
      bubble.className = 'boost-bubble';
      bubble.textContent = message.text;
      const time = document.createElement('div');
      time.className = 'boost-time';
      const readBy = message.role === 'visitor' ? 'Matt' : 'visitor';
      time.textContent = 'Sent ' + clock(message.at) + (message.role === 'boost' ? '' : message.readAt ? ' · Read by ' + readBy + ' ' + clock(message.readAt) : ' · Not read yet');
      item.append(byline, bubble, time);
      target.append(item);
    });
    target.scrollTop = target.scrollHeight;
  }
  function render() {
    const customer = state.mode === 'customer';
    el('boost-customer-panel').hidden = !customer;
    el('boost-inbox-panel').hidden = customer;
    el('boost-customer-tab').setAttribute('aria-selected', String(customer));
    el('boost-inbox-tab').setAttribute('aria-selected', String(!customer));
    el('boost-idle').hidden = state.open;
    el('boost-chat').hidden = !state.open;
    el('boost-launcher').setAttribute('aria-expanded', String(state.open));
    el('boost-launcher-row').hidden = !customer;
    el('boost-launcher-label').textContent = state.open ? 'Boost stays clear of the controls' : 'Tap Boost to chat';
    el('boost-inbox-empty').hidden = state.queued;
    el('boost-inbox-content').hidden = !state.queued;
    el('boost-resolve').textContent = state.closed ? 'Reopen conversation' : 'Close conversation';
    el('boost-message').disabled = state.closed;
    el('boost-reply').disabled = state.closed;
    el('boost-handoff').disabled = state.closed;
    el('boost-handoff').textContent = state.queued ? 'In Matt’s test inbox' : 'Message PSI';
    root.querySelectorAll('.boost-send, [data-command]').forEach(button => { button.disabled = state.closed; });
    el('boost-notice').textContent = state.notice;
    el('boost-notice').hidden = !state.notice;
    messages(el('boost-customer-messages'));
    if (state.queued) messages(el('boost-inbox-messages'));
  }
  function showError(id, text) { el(id).textContent = text || ''; el(id).hidden = !text; }
  function send(value) {
    const result = engine.send(state, value);
    if (result.reset) state = result.state;
    showError('boost-customer-error', result.error);
    if (result.ok) {
      el('boost-message').value = '';
      engine.view(state, 'customer');
      // Keep the handoff banner visible while the visitor is still looking at it.
      if (state.queued) state.notice = 'Test handoff in Matt’s inbox. No real alert sent.';
      render(); remember();
    }
  }
  el('boost-customer-form').addEventListener('submit', event => { event.preventDefault(); send(el('boost-message').value); });
  el('boost-inbox-form').addEventListener('submit', event => {
    event.preventDefault();
    const result = engine.reply(state, el('boost-reply').value);
    showError('boost-inbox-error', result.error);
    if (result.ok) { el('boost-reply').value = ''; render(); remember(); }
  });
  root.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => send(button.dataset.command)));
  el('boost-handoff').addEventListener('click', () => { const result = engine.handoff(state); showError('boost-customer-error', result.error); render(); remember(); });
  for (const [id, mode] of [['boost-customer-tab', 'customer'], ['boost-inbox-tab', 'inbox']]) {
    el(id).addEventListener('click', () => { engine.view(state, mode); render(); remember(); });
    el(id).addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 'customer' : event.key === 'End' ? 'inbox' : mode === 'customer' ? 'inbox' : 'customer';
        engine.view(state, next); render(); remember();
        el(next === 'customer' ? 'boost-customer-tab' : 'boost-inbox-tab').focus();
      }
    });
  }
  el('boost-close').addEventListener('click', () => { state.open = false; render(); remember(); el('boost-launcher').focus(); });
  el('boost-launcher').addEventListener('click', () => { state.open = true; engine.view(state, 'customer'); render(); remember(); el('boost-message').focus(); });
  el('boost-resolve').addEventListener('click', () => { state.closed = !state.closed; state.notice = state.closed ? 'Test conversation closed. Reopen to continue.' : 'Test conversation reopened.'; render(); remember(); });
  el('boost-reset').addEventListener('click', () => {
    state = engine.createSession();
    el('boost-message').value = ''; el('boost-reply').value = '';
    showError('boost-customer-error', ''); showError('boost-inbox-error', '');
    render(); remember();
  });
  // The character uses a separate space below the composer. Hide it while typing.
  root.addEventListener('focusin', event => { if (event.target.tagName === 'TEXTAREA') el('boost-launcher-row').hidden = true; });
  root.addEventListener('focusout', () => { el('boost-launcher-row').hidden = state.mode !== 'customer'; });
  window.addEventListener('openai:set_globals', event => restore(event.detail && event.detail.globals));
  restore(window.openai ? { widgetState: window.openai.widgetState } : null);
})();
