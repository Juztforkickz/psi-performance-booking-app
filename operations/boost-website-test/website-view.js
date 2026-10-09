(function () {
  'use strict';
  const root = document.getElementById('psi-boost-website-placement');
  const engine = window.BoostWebsiteTest;
  const el = id => root.querySelector('#' + id);
  let state = engine.createSession();
  const clock = stamp => new Date(stamp).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });

  function remember() {
    if (window.openai && typeof window.openai.setWidgetState === 'function') {
      Promise.resolve(window.openai.setWidgetState({ modelContent: { previewOnly: true, intent: state.intent, testHandoff: state.queued }, privateContent: { open: state.open, mode: state.mode } })).catch(() => {});
    }
  }
  function restore(globals) {
    const saved = globals && globals.widgetState && globals.widgetState.privateContent;
    if (saved && typeof saved.open === 'boolean') state.open = saved.open;
    if (saved && ['customer', 'inbox'].includes(saved.mode)) state.mode = saved.mode;
    render();
  }
  function error(id, message) { el(id).textContent = message || ''; el(id).hidden = !message; }
  function render() {
    const inbox = state.mode === 'inbox';
    el('bp-chat').hidden = !state.open;
    el('bp-ask-label').hidden = state.open;
    el('bp-launcher').setAttribute('aria-expanded', String(state.open));
    el('bp-launcher').setAttribute('aria-label', state.open ? 'Minimise Boost conversation' : 'Open Boost conversation');
    el('bp-chat-title').firstChild.textContent = inbox ? 'Matt’s test inbox ' : 'Ask PSI ';
    const psiHasReplied = state.messages.at(-1).role === 'matt';
    el('bp-status').textContent = inbox ? 'Simulated workshop reply' : state.queued ? psiHasReplied ? 'PSI replied · Test inbox' : 'Waiting for PSI · Test inbox' : 'Quick answers from Boost';
    el('bp-test-inbox').textContent = inbox ? 'Visitor view' : 'Matt’s test inbox';
    el('bp-inbox-empty').hidden = !inbox || state.queued;
    el('bp-transcript').hidden = inbox && !state.queued;
    el('bp-form').hidden = inbox;
    el('bp-inbox-form').hidden = !inbox || !state.queued;
    el('bp-quick').hidden = inbox || state.queued || state.messages.some(message => message.role === 'visitor');
    el('bp-handoff').textContent = state.queued ? 'In Matt’s test inbox' : 'Message PSI';
    el('bp-handoff').disabled = state.queued;
    const target = el('bp-transcript');
    target.replaceChildren();
    state.messages.forEach(message => {
      const item = document.createElement('article');
      item.className = 'bp-message ' + message.role;
      const byline = document.createElement('p');
      byline.className = 'bp-byline';
      byline.textContent = message.role === 'visitor' ? 'You' : message.role === 'matt' ? 'Matt · Test reply' : 'Boost';
      const bubble = document.createElement('div');
      bubble.className = 'bp-bubble';
      bubble.textContent = message.text;
      const time = document.createElement('div');
      time.className = 'bp-time';
      time.textContent = clock(message.at) + (message.role === 'boost' ? '' : message.readAt ? ' · Read ' + clock(message.readAt) : ' · Sent');
      item.append(byline, bubble, time);
      target.append(item);
    });
    target.scrollTop = target.scrollHeight;
  }
  function send(value) {
    const result = engine.send(state, value);
    if (result.reset) state = result.state;
    error('bp-error', result.error);
    if (result.ok) {
      el('bp-message').value = '';
      engine.view(state, 'customer');
      render(); remember();
    }
  }
  function view(mode) { state.open = true; engine.view(state, mode); render(); remember(); }
  function close() {
    state.open = false;
    root.classList.remove('bp-typing');
    render(); remember(); el('bp-launcher').focus();
  }
  el('bp-form').addEventListener('submit', event => { event.preventDefault(); send(el('bp-message').value); });
  el('bp-inbox-form').addEventListener('submit', event => {
    event.preventDefault();
    const result = engine.reply(state, el('bp-reply').value);
    error('bp-inbox-error', result.error);
    if (result.ok) { el('bp-reply').value = ''; render(); remember(); }
  });
  root.querySelectorAll('[data-ask]').forEach(button => button.addEventListener('click', () => send(button.dataset.ask)));
  el('bp-handoff').addEventListener('click', () => { const result = engine.handoff(state); error('bp-error', result.error); render(); remember(); });
  el('bp-test-inbox').addEventListener('click', () => view(state.mode === 'customer' ? 'inbox' : 'customer'));
  el('bp-visitor').addEventListener('click', () => view('customer'));
  el('bp-close').addEventListener('click', close);
  el('bp-launcher').addEventListener('click', () => { if (state.open) close(); else view('customer'); });
  el('bp-reset').addEventListener('click', () => {
    state = engine.createSession();
    el('bp-message').value = ''; el('bp-reply').value = '';
    error('bp-error', ''); error('bp-inbox-error', ''); render(); remember();
  });
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && state.open) close(); });
  // Leave room for a phone keyboard and hide the mascot while composing.
  root.addEventListener('focusin', event => { if (event.target.tagName === 'TEXTAREA') root.classList.add('bp-typing'); });
  root.addEventListener('focusout', event => { if (!event.relatedTarget || event.relatedTarget.tagName !== 'TEXTAREA') root.classList.remove('bp-typing'); });
  function fitViewport() {
    if (document.body.classList.contains('boost-website-standalone') && window.visualViewport) {
      root.style.height = Math.round(window.visualViewport.height) + 'px';
    }
  }
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitViewport);
  window.addEventListener('openai:set_globals', event => restore(event.detail && event.detail.globals));
  fitViewport();
  restore(window.openai ? { widgetState: window.openai.widgetState } : null);
})();
