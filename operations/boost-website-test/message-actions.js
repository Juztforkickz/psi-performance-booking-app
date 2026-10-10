(function () {
  'use strict';
  // Only curated link IDs become anchors. Never turn visitor text into a URL.
  window.appendBoostActions = function (item, message, send, active, getEnquiry) {
    if (message.role !== 'boost' || !active) return;
    const actions = document.createElement('div');
    actions.className = 'boost-answer-actions';
    for (const key of message.links || []) {
      if (!Object.hasOwn(window.BoostKnowledge.LINKS, key)) continue;
      const link = window.BoostKnowledge.LINKS[key];
      const anchor = document.createElement('a');
      anchor.textContent = link.label;
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      actions.append(anchor);
    }
    for (const text of message.prompts || []) {
      if (text === 'Message PSI') continue; // The composer already has this permanent action.
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = text;
      button.className = 'cursor-interaction';
      button.addEventListener('click', () => send(text));
      actions.append(button);
    }
    if (message.copyEnquiry && typeof getEnquiry === 'function') {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = 'Copy my enquiry';
      button.className = 'cursor-interaction';
      const panel = document.createElement('div'); panel.className = 'boost-copy-panel';
      const status = document.createElement('p');
      status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      const fallback = document.createElement('label');
      fallback.textContent = 'Your enquiry to copy'; fallback.hidden = true;
      const draft = document.createElement('textarea');
      draft.readOnly = true; draft.rows = 7;
      draft.setAttribute('aria-label', 'Your enquiry to copy');
      fallback.append(draft); panel.append(status, fallback);
      button.addEventListener('click', async () => {
        button.disabled = true;
        status.textContent = ''; fallback.hidden = true; draft.value = '';
        try {
          // Ask the engine for the curated draft only. Do not copy the conversation or send it.
          const text = getEnquiry();
          if (typeof text !== 'string' || !text.trim()) {
            status.textContent = 'There is no enquiry to copy yet. Add your vehicle and requested work first.';
            return;
          }
          try {
            if (!window.navigator.clipboard || typeof window.navigator.clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
            await window.navigator.clipboard.writeText(text);
            status.textContent = 'Enquiry copied. Paste it into your app booking notes or website enquiry. Nothing has been sent.';
          } catch {
            draft.value = text; fallback.hidden = false;
            status.textContent = 'Copy was unavailable. Select and copy your enquiry below. Nothing has been sent.';
            draft.focus(); draft.select();
          }
        } catch {
          status.textContent = 'The enquiry could not be prepared. Choose Review my request and try again.';
        } finally {
          button.disabled = false;
        }
      });
      actions.append(button, panel);
    }
    if (actions.childElementCount) item.append(actions);
  };
  window.appendBoostSummary = function (target, summary) {
    if (!summary) return;
    const panel = document.createElement('details');
    panel.className = 'boost-handoff-summary';
    const title = document.createElement('summary'); title.textContent = 'Request summary for PSI';
    panel.append(title);
    const fields = [
      ['Vehicle as supplied', summary.vehicle], ['Year', summary.year], ['Requested work', summary.work],
      ['Odometer', summary.mileage], ['Setup and request', summary.details],
      ['Questions for PSI to review', summary.needsReview.join('\n') || 'Confirm the requested work and any price or availability.'],
      ['Recent visitor messages', summary.recentMessages.join('\n')], ['Status', summary.status],
    ];
    for (const [label, value] of fields) {
      const row = document.createElement('p'), heading = document.createElement('strong'), content = document.createElement('span');
      heading.textContent = label; content.textContent = value;
      row.append(heading, content); panel.append(row);
    }
    target.append(panel);
  };
})();
