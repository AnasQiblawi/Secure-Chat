$(document).ready(function () {
  const notyf = new Notyf();

  // Check for saved dark mode preference
  localforage.getItem('darkMode').then(function (darkMode) {
    if (darkMode) {
      $('body').addClass('dark-mode');
      $('#darkMode').prop('checked', true);
    }
  });

  $('#loginForm').submit(function (e) {
    e.preventDefault();
    const username = $('#username').val();
    const privateKey = $('#privateKey').val();
    const keySize = $('#keySize').val();
    const darkMode = $('#darkMode').is(':checked');

    if (username.length > 20) {
      notyf.error('Username must be 20 characters or less');
      return;
    }

    const messenger = new Messenger(username, { privateKey, keySize: parseInt(keySize) });

    const userData = {
      username,
      privateKey: messenger.getPrivateKey(),
      publicKey: messenger.getPublicKey(),
      darkMode
    };

    localforage.setItem('userData', userData).then(function () {
      window.location.href = '/chat';
    });
  });

  $('#darkMode').change(function () {
    const darkMode = $(this).is(':checked');
    $('body').toggleClass('dark-mode', darkMode);
    localforage.setItem('darkMode', darkMode);
  });

  $('#importData').click(function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function (event) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const importedData = JSON.parse(e.target.result);
          $('#username').val(importedData.username);
          $('#privateKey').val(importedData.privateKey);
          $('#darkMode').prop('checked', importedData.darkMode);
          notyf.success('User data imported successfully');
        } catch (error) {
          notyf.error('Error importing user data');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
});