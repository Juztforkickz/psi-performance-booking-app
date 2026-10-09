(function () {
  'use strict';
  // Only curated link IDs become anchors. Never turn visitor text into a URL.
  window.appendBoostActions = function (item, message, send, active) {
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
    if (actions.childElementCount) item.append(actions);
  };
})();
