/* Accessible presentation adapter for the legacy synchronous prompt/confirm flows. */
(function () {
  function openDialog({ title, message = '', value = '', placeholder = '', confirmLabel = 'Продолжить', danger = false, input = false }) {
    return new Promise(resolve => {
      const previousFocus = document.activeElement;
      const layer = document.createElement('div');
      layer.className = 'fg-dialog-layer';
      layer.setAttribute('role', 'presentation');
      const dialog = document.createElement('section');
      dialog.className = 'fg-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'fg-dialog-title');
      const heading = document.createElement('h2');
      heading.id = 'fg-dialog-title';
      heading.textContent = title;
      const copy = document.createElement('p');
      copy.textContent = message;
      dialog.append(heading);
      if (message) dialog.append(copy);
      let field;
      if (input) {
        field = document.createElement('input');
        field.type = 'text';
        field.value = value ?? '';
        field.placeholder = placeholder;
        field.setAttribute('aria-label', title);
        dialog.append(field);
      }
      const actions = document.createElement('div');
      actions.className = 'fg-dialog-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Отмена';
      const accept = document.createElement('button');
      accept.type = 'button';
      accept.className = danger ? 'fg-dialog-danger' : 'fg-dialog-primary';
      accept.textContent = confirmLabel;
      actions.append(cancel, accept);
      dialog.append(actions);
      layer.append(dialog);
      document.body.append(layer);
      const finish = result => { document.removeEventListener('keydown', onKey); layer.remove(); previousFocus?.focus(); resolve(result); };
      const onKey = event => {
        const first = field || cancel;
        if (event.key === 'Tab' && event.shiftKey && document.activeElement === first) {
          event.preventDefault(); accept.focus();
        } else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === accept) {
          event.preventDefault(); first.focus();
        }
        if (event.key === 'Escape') finish(null);
        if (event.key === 'Enter' && input && document.activeElement === field) finish(field.value);
      };
      document.addEventListener('keydown', onKey);
      cancel.addEventListener('click', () => finish(null));
      accept.addEventListener('click', () => finish(input ? field.value : true));
      layer.addEventListener('click', event => { if (event.target === layer) finish(null); });
      (field || cancel).focus();
    });
  }
  window.floralPrompt = (title, value = '', message = '') => openDialog({ title, value, message, input: true });
  window.floralConfirm = (message, { title = 'Подтвердите действие', confirmLabel = 'Подтвердить', danger = false } = {}) => openDialog({ title, message, confirmLabel, danger }).then(Boolean);
})();
