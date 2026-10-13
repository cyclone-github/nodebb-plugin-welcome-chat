import { save, load } from 'settings';

export function init() {
  const form = $('.welcome-chat-settings');
  load('welcome-chat', form);
  $('#save').on('click', () => {
    save('welcome-chat', form);
  });
}
