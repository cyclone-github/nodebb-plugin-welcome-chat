import { save, load } from 'settings';

// The hidden input is the persisted setting. Buttons only edit its value.
// Keeping the groupNames key preserves pre-0.4.1 installations.
export function init() {
  const form = $('.welcome-chat-settings');
  const input = form.find('#groupNames');
  const groupContainer = form.find('#staff-group-options');

  function currentSelection() {
    const raw = String(input.val() || '');
    if (raw.trimStart().startsWith('[')) {
      try {
        const names = JSON.parse(raw);
        if (Array.isArray(names)) {
          return [...new Set(names.filter(name => typeof name === 'string').map(name => name.trim()).filter(Boolean))];
        }
      } catch {
        return [];
      }
      return [];
    }
    return [...new Set(raw.split(/[\r\n,]+/).map(name => name.trim()).filter(Boolean))];
  }

  function refreshButtons() {
    const selected = new Set(currentSelection());
    const available = new Set();
    groupContainer.find('.welcome-chat-group').each(function () {
      const button = $(this);
      if (button.attr('data-missing') === 'true') {
        button.remove();
      } else {
        available.add(button.attr('data-group-name'));
      }
    });
    // Display older saved groups that have since been deleted or renamed, so
    // administrators can remove them without editing a hidden input.
    for (const name of selected) {
      if (!available.has(name)) {
        $('<button type="button" class="btn btn-outline-warning btn-sm welcome-chat-group" aria-pressed="true" data-missing="true"></button>')
          .attr('data-group-name', name)
          .text(`${name} (not found)`)
          .appendTo(groupContainer);
      }
    }
    groupContainer.find('.welcome-chat-group').each(function () {
      const button = $(this);
      const active = selected.has(button.attr('data-group-name'));
      button.attr('aria-pressed', String(active));
      if (button.attr('data-missing') !== 'true') {
        button.toggleClass('btn-primary', active);
        button.toggleClass('btn-outline-secondary', !active);
      }
    });
  }

  groupContainer.on('click', '.welcome-chat-group', function () {
    const name = $(this).attr('data-group-name');
    const selected = currentSelection();
    const index = selected.indexOf(name);
    if (index === -1) {
      if (selected.length >= 10) {
        // A maximum of 10 groups is supported by the backend.
        form.find('#staff-group-warning').removeClass('d-none');
        return;
      }
      selected.push(name);
    } else {
      selected.splice(index, 1);
    }
    input.val(JSON.stringify(selected)).trigger('change');
    form.find('#staff-group-warning').addClass('d-none');
    refreshButtons();
  });

  // settings.load is asynchronous; wait until saved settings are in the form.
  load('welcome-chat', form, (err) => {
    if (err) {
      console.error('[welcome-chat] Could not load settings', err);
      return;
    }
    refreshButtons();
  });

  $('#save').off('click.welcomeChat').on('click.welcomeChat', () => {
    save('welcome-chat', form);
  });
}
