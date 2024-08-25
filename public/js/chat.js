
// Main application initialization
$(document).ready(() => {
  const app = new MessengerApp();
  app.initialize();
});



/**
 * MessengerApp Class
 * Manages the main functionality of the messenger application.
 */
class MessengerApp {
  /**
   * Constructor: Initializes the MessengerApp instance.
   */
  constructor() {
    this.initializeProperties();
    this.initializeUI();
    this.setupEventListeners();
    this.setupSocketHandlers();
  }

  /**
   * Initializes class properties.
   */
  initializeProperties() {
    this.messenger = null;
    this.socket = io();
    this.users = new Map();
    this.currentRecipient = null;
    this.conversations = new Map();
    this.notyf = new Notyf();
    this.clipboard = new ClipboardJS(".copy-btn");
  }

  /**
   * Initializes the UI components.
   */
  initializeUI() {
    NProgress.configure({ showSpinner: true });
  }

  /**
   * Sets up event listeners for various UI elements.
   */
  setupEventListeners() {
    $("#messageForm").on("submit", (e) => this.sendMessage(e));
    $("#exportBtn").on("click", () => this.exportUserData());
    $("#message").on("input", () => this.handleTyping());
    $("#logoutBtn").on("click", () => this.handleLogout());
    $("#darkModeToggle").change(() => this.handleDarkModeToggle());
    $("#hideUserToggle").change(() => this.handleHideUserToggle());
    this.clipboard.on("success", () => this.notyf.success("Copied to clipboard"));
  }

  /**
   * Sets up socket event handlers.
   */
  setupSocketHandlers() {
    this.socket.on("connect", () => this.updateServerStatus(true));
    this.socket.on("disconnect", () => this.updateServerStatus(false));
    this.socket.on("userList", (userList) => this.handleUserList(userList));
    this.socket.on("receiveMessage", (encryptedPackage) => this.handleReceiveMessage(encryptedPackage));
    this.socket.on("userOnline", (username) => this.handleUserOnline(username));
    this.socket.on("userOffline", (username) => this.handleUserOffline(username));
    this.socket.on("userTyping", ({ sender, isTyping }) => this.handleUserTyping(sender, isTyping));
    this.socket.on("messageSent", ({ recipient, timestamp }) => this.handleMessageSent(recipient, timestamp));
    this.socket.on("messageDeliveryStatus", ({ recipient, timestamp, status }) => this.handleMessageDeliveryStatus(recipient, timestamp, status));
    this.socket.on("messageSeenStatus", ({ recipient, timestamp }) => this.handleMessageSeenStatus(recipient, timestamp));
  }

  /**
   * Initializes the messenger application.
   */
  async initialize() {
    try {
      NProgress.start();
      await this.initializeMessenger();
      NProgress.done();
    } catch (error) {
      NProgress.done();
      this.showError("Failed to initialize messenger", error);
    }
  }

  /**
   * Initializes the messenger with user data and loads conversations.
   */
  async initializeMessenger() {
    const userData = await localforage.getItem("userData");
    if (!userData) {
      window.location.href = "/";
      return;
    }

    this.setupMessenger(userData);
    this.updateUIWithUserData(userData);
    this.joinSocket(userData);
    await this.loadSavedConversations();
  }

  /**
   * Sets up the messenger with user data.
   * @param {Object} userData - User data object.
   */
  setupMessenger(userData) {
    this.messenger = new Messenger(userData.username, {
      privateKey: userData.privateKey,
    });
  }

  /**
   * Updates UI elements with user data.
   * @param {Object} userData - User data object.
   */
  updateUIWithUserData(userData) {
    $("#username").text(userData.username);
    this.applyDarkMode(userData.darkMode);
  }

  /**
   * Joins the socket with user information.
   * @param {Object} userData - User data object.
   */
  joinSocket(userData) {
    this.socket.emit("join", {
      username: userData.username,
      publicKey: userData.publicKey,
      isHidden: false,
    });
  }

  /**
   * Loads saved conversations from local storage.
   */
  async loadSavedConversations() {
    const savedConversations = await localforage.getItem('conversations');
    if (savedConversations) {
      this.conversations = new Map(savedConversations);
      this.renderAllConversations();
    }
  }

  /**
   * Applies dark mode to the UI.
   * @param {boolean} darkMode - Whether dark mode should be applied.
   */
  applyDarkMode(darkMode) {
    $('[data-bs-theme]').attr('data-bs-theme', darkMode ? 'dark' : 'light'); // Default Bootstrap method
    $("body").toggleClass("dark-mode", darkMode);
    $(".navbar").toggleClass("navbar-light bg-light", !darkMode)
      .toggleClass("navbar-dark bg-dark", darkMode);
    $("#darkModeToggle").prop("checked", darkMode);

    if (darkMode) {
      $(".text-muted").addClass("text-light").removeClass("text-muted");
    } else {
      $(".text-light").addClass("text-muted").removeClass("text-light");
    }
  }

  /**
   * Updates the user list in the UI.
   * @param {Array} userList - List of users.
   */
  updateUserList(userList) {
    const $onlineUsersList = $("#onlineUsersList");
    const $chatHistoryList = $("#chatHistoryList");
    const onlineUsers = new Set();

    $onlineUsersList.empty();
    $chatHistoryList.empty();

    
    userList.forEach(user => {
      if (user.username !== this.messenger.name) {
        onlineUsers.add(user.username);
      }
    })

    this.updateOnlineUsers(userList, onlineUsers, $onlineUsersList);
    this.updateChatHistory(onlineUsers, $chatHistoryList);
  }

  /**
   * Updates the list of online users.
   * @param {Array} userList - List of users.
   * @param {Set} onlineUsers - Set to store online users.
   * @param {jQuery} $onlineUsersList - jQuery object for the online users list.
   */
  updateOnlineUsers(userList, onlineUsers, $onlineUsersList) {
    userList.forEach(user => {
      if (user.username !== this.messenger.name) {
        // onlineUsers.add(user.username);
        const $userElement = this.createUserElement({ username: user.username, isOnline: true });
        if (!user.isHidden) {
          $onlineUsersList.append($userElement);
        }
      }
    });
  }

  /**
   * Updates the chat history list.
   * @param {Set} onlineUsers - Set of online users.
   * @param {jQuery} $chatHistoryList - jQuery object for the chat history list.
   */
  updateChatHistory(onlineUsers, $chatHistoryList) {
    this.conversations.forEach((messages, username) => {
      const isOnline = onlineUsers.has(username);
      const $userElement = this.createUserElement({ username, isOnline });
      if (messages.length > 0) {
        $chatHistoryList.append($userElement);
      }
    });
  }

  /**
   * Creates a user element for the UI.
   * @param {Object} user - User object.
   * @returns {jQuery} - jQuery object representing the user element.
   */
  createUserElement(user) {
    return $("<div>")
      .addClass("user-item mb-2")
      .html(`
        <span class="user-status ${user.isOnline ? "online" : "offline"}"></span>
        <span class="user-name">${user.username}</span>
      `)
      .click(() => this.selectRecipient(user));
  }

  

  /**
   * Creates a user element for the UI.
   * @param {string} username - Username to create the element for.
   * @returns {jQuery} jQuery object representing the user element.
   */
  // createUserElement(username) {
  //   const isOnline = this.users.has(username) && this.users.get(username).isOnline;
  //   const statusClass = isOnline ? "online" : "offline";

  //   return $("<div>")
  //     .addClass("user-item mb-2")
  //     .html(`
  //       <span class="user-status ${statusClass}"></span>
  //       <span class="user-name">${username}</span>
  //     `)
  //     .click(() => this.selectRecipient(username));
  // }


  /**
   * Selects a recipient for messaging.
   * @param {string} recipientUsername - Username of the recipient.
   */
  selectRecipient(user) {
    let { username, isOnline } = user;
    this.currentRecipient = username;

    $('#chatHeader').text(`Chatting with: ${username}`);

    if (!this.conversations.has(username)) {
      this.conversations.set(username, []);
      this.addUserToConversationList(username, isOnline);
    }

    this.displayConversation(username);
  }

  /**
   * Displays the conversation with a specific user.
   * @param {string} username - Username of the conversation partner.
   */
  displayConversation(username) {
    const $chatBox = $("#chatBox");
    $chatBox.empty();

    if (this.conversations.has(username)) {
      this.conversations.get(username).forEach((message) => {
        this.appendMessageToUI(message);
      });
    }

    $chatBox.scrollTop($chatBox[0].scrollHeight);
  }

  /**
   * Shows an error message.
   * @param {string} message - Error message to display.
   * @param {Error} error - Error object for logging.
   */
  showError(message, error) {
    console.error(message, error);
    this.notyf.error(message);
  }

  /**
   * Sends a message to the current recipient.
   * @param {Event} e - Form submit event.
   */
  sendMessage(e) {
    e.preventDefault();
    const message = $('#message').val();
    if (!this.currentRecipient) {
      this.showError('Please select a recipient');
      return;
    }
    const recipientPublicKey = this.users.get(this.currentRecipient);
    if (recipientPublicKey) {
      this.sendEncryptedMessage(message, recipientPublicKey);
    } else {
      this.notyf.error('Recipient not found or not online.');
    }
  }

  /**
   * Sends an encrypted message to the recipient.
   * @param {string} message - Message to send.
   * @param {string} recipientPublicKey - Recipient's public key.
   */
  sendEncryptedMessage(message, recipientPublicKey) {
    const encryptedPackage = this.messenger.sendMessage(message, recipientPublicKey);
    NProgress.start();
    this.socket.emit('sendMessage', { recipient: this.currentRecipient, encryptedPackage });

    const messageObj = {
      sender: this.messenger.name,
      message: message,
      isSignatureValid: true,
      timestamp: encryptedPackage.timestamp,
      status: 'sending'
    };

    this.addMessageToConversation(this.currentRecipient, messageObj);
    this.appendMessageToUI(messageObj);
    this.updateUIAfterSendingMessage();
  }

  /**
   * Updates the UI after sending a message.
   */
  updateUIAfterSendingMessage() {
    const $chatBox = $('#chatBox');
    $chatBox.scrollTop($chatBox[0].scrollHeight);
    $('#message').val('');
    playAlert('funk');
    NProgress.done();
  }

  /**
   * Exports user data.
   */
  exportUserData() {
    NProgress.start();
    const exportHtml = `
        <div>
            <label>
                <input type="checkbox" id="exportWithChatHistory" /> Include chat history
            </label>
        </div>
    `;

    Swal.fire({
      title: "Export User Data",
      html: exportHtml,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Export",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        this.performExport();
      } else {
        NProgress.done();
      }
    }).catch(() => {
      NProgress.done();
    });
  }

  /**
   * Performs the actual export of user data.
   */
  performExport() {
    const exportWithChatHistory = document.getElementById('exportWithChatHistory').checked;
    localforage.getItem("userData").then((userData) => {
      if (exportWithChatHistory) {
        userData.conversations = Array.from(this.conversations);
      }
      const dataStr = JSON.stringify(userData);
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
      const exportFileDefaultName = "user_data.json";

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();
      NProgress.done();
    });
  }

  /**
   * Handles user typing event.
   */  
  handleTyping() {
    if (!this.currentRecipient) return;
  
    clearTimeout(this.typingTimer);
    this.socket.emit('typing', { recipient: this.currentRecipient, isTyping: true });
  
    this.typingTimer = setTimeout(() => {
      this.socket.emit('typing', { recipient: this.currentRecipient, isTyping: false });
    }, 1000);
  }

  /**
   * Handles user logout.
   */
  handleLogout() {
    Swal.fire({
      title: "Are you sure?",
      text: "You will be logged out of the application.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, log out!",
    }).then((result) => {
      if (result.isConfirmed) {
        localforage.clear().then(() => {
          window.location.href = "/";
        });
      }
    });
  }

  /**
   * Handles dark mode toggle.
   */
  handleDarkModeToggle() {
    const darkMode = $("#darkModeToggle").is(":checked");
    this.applyDarkMode(darkMode);
    localforage.getItem("userData").then((userData) => {
      userData.darkMode = darkMode;
      localforage.setItem("userData", userData);
    });
  }

  /**
   * Handles hiding user toggle.
   */
  handleHideUserToggle() {
    const isHidden = $("#hideUserToggle").is(":checked");
    this.socket.emit("toggleHidden", isHidden);

    localforage.getItem("userData").then((userData) => {
      userData.isHidden = isHidden;
      localforage.setItem("userData", userData);
    });
  }

  /**
   * Updates the server connection status in the UI.
   * @param {boolean} isConnected - Whether the server is connected.
   */
  updateServerStatus(isConnected) {
    $("#serverStatus")
      .text(isConnected ? "Connected" : "Disconnected")
      .removeClass(isConnected ? "bg-danger" : "bg-success")
      .addClass(isConnected ? "bg-success" : "bg-danger");
  }

  /**
   * Handles the user list received from the server.
   * @param {Array} userList - List of users.
   */
  handleUserList(userList) {
    userList.forEach((user) => {
      if (!this.users.has(user.username)) {
        this.users.set(user.username, user.publicKey)
      }
    });
    this.updateUserList(userList);
  }

  /**
   * Handles receiving a message.
   * @param {Object} encryptedPackage - Encrypted message package.
   */
  handleReceiveMessage(encryptedPackage) {
    try {
      const senderPublicKey = this.users.get(encryptedPackage.sender);
      const decryptedMessage = this.messenger.receiveMessage(encryptedPackage, senderPublicKey);

      this.addMessageToConversation(decryptedMessage.sender, decryptedMessage);

      if (this.currentRecipient === decryptedMessage.sender) {
        this.appendMessageToUI(decryptedMessage);
      } else {
        this.notyf.success(`New message from ${decryptedMessage.sender}`);
      }

      this.socket.emit('messageDelivered', { sender: decryptedMessage.sender, timestamp: decryptedMessage.timestamp });

      playAlert('funk');
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      this.notyf.error('Failed to decrypt a message. Please try again.');
    }
  }

  /**
   * Handles user coming online.
   * @param {string} username - Username of the user who came online.
   */
  handleUserOnline(username) {
    if (this.users.has(username)) {
      this.users.get(username).isOnline = true;
      this.updateUserList(Array.from(this.users.values()));
    }
  }

  /**
   * Handles user going offline.
   * @param {string} username - Username of the user who went offline.
   */
  handleUserOffline(username) {
    if (this.users.has(username)) {
      this.users.get(username).isOnline = false;
      this.updateUserList(Array.from(this.users.values()));
    }
  }

  /**
   * Handles message sent confirmation.
   * @param {string} recipient - Recipient of the message.
   * @param {number} timestamp - Timestamp of the message.
   */
  handleMessageSent(recipient, timestamp) {
    this.updateMessageStatus(recipient, timestamp, 'sent');
  }

  /**
   * Handles message delivery status update.
   * @param {string} recipient - Recipient of the message.
   * @param {number} timestamp - Timestamp of the message.
   */
  handleMessageDeliveryStatus(recipient, timestamp) {
    this.updateMessageStatus(recipient, timestamp, 'delivered');
  }

  /**
   * Handles message seen status update.
   * @param {string} recipient - Recipient of the message.
   * @param {number} timestamp - Timestamp of the message.
   */
  handleMessageSeenStatus(recipient, timestamp) {
    this.updateMessageStatus(recipient, timestamp, 'seen');
  }

  /**
   * Handles user typing indication.
   * @param {string} sender - Username of the typing user.
   * @param {boolean} isTyping - Whether the user is typing.
   */
  handleUserTyping(sender, isTyping) {
    if (sender === this.currentRecipient) {
      const $typingIndicator = $('#typingIndicator');
      if (isTyping) {
        $typingIndicator.text(`typing...`);
      } else {
        $typingIndicator.text('');
      }
    }
  }

  /**
   * Adds a message to the conversation.
   * @param {string} username - Username of the sender.
   * @param {Object} message - Message object to add.
   */
  addMessageToConversation(username, message) {
    if (!this.conversations.has(username)) {
      this.conversations.set(username, []);
      this.addUserToConversationList(username);
    }
    this.conversations.get(username).push(message);
    this.saveConversation(username);
  }

  /**
   * Renders all conversations in the UI.
   */
  renderAllConversations() {
    const $chatHistoryList = $("#chatHistoryList");
    $chatHistoryList.empty();

    this.conversations.forEach((messages, username) => {
      if (messages.length > 0) {
        const $userElement = this.createUserElement({ username, isOnline: false });
        $chatHistoryList.append($userElement);
      }
    });
  }

  /**
   * Adds a user to the conversation list in the UI.
   * @param {string} username - Username to add to the list.
   */
  addUserToConversationList(username, isOnline) {
    const $chatHistoryList = $("#chatHistoryList");
    const $userElement = this.createUserElement({ username, isOnline });
    $chatHistoryList.append($userElement);
  }

  /**
   * Appends a message to the UI.
   * @param {Object} message - Message object to append.
   */
  appendMessageToUI(message) {
    const $chatBox = $('#chatBox');
    const $messageElement = this.createMessageElement(message);

    // Calculate if the scroll position is near the bottom (within 50px of the bottom)
    const isNearBottom = $chatBox.scrollTop() + $chatBox.innerHeight() >= $chatBox[0].scrollHeight - 50;

    // Append the new message to the chat box
    $chatBox.append($messageElement);

    // If the user was already near the bottom, scroll to the bottom
    if (isNearBottom) {
      $chatBox.scrollTop($chatBox[0].scrollHeight);
    }

    // Observe message visibility if the message was sent by someone else
    if (message.sender !== this.messenger.name) {
      this.observeMessageVisibility($messageElement[0], message);
    }
  }

  /**
   * Creates a message element for the UI.
   * @param {Object} message - Message object to create an element for.
   * @returns {jQuery} jQuery object representing the message element.
   */
  createMessageElement(message) {
    return $('<div>')
      .addClass(`mb-2 ${message.sender === this.messenger.name ? 'message-sent' : 'message-received'}`)
      .attr('data-message-id', message.timestamp)
      .html(`
        <span class="user-status ${message.isSignatureValid ? 'online' : 'offline'}"></span>
        <strong>${message.sender}:</strong> ${message.message}
        <!--
        <span class="text-${message.isSignatureValid ? 'success' : 'danger'}">
          ${message.isSignatureValid ? '✓' : '❌'}
        </span>
        -->
        <small class="text-muted">${new Date(message.timestamp).toLocaleString()}</small>
        ${ message.sender === this.messenger.name ? `<span class="message-status">${message.status || 'sending'}</span>` : '' }
      `);
  }

  /**
   * Saves the conversation to local storage.
   * @param {string} username - Username of the conversation partner.
   */
  saveConversation(username) {
    localforage.setItem('conversations', Array.from(this.conversations.entries()));
  }

  /**
   * Updates the status of a message in the UI and storage.
   * @param {string} recipient - Recipient of the message.
   * @param {number} timestamp - Timestamp of the message.
   * @param {string} status - New status of the message.
   */
  updateMessageStatus(recipient, timestamp, status) {
    const conversation = this.conversations.get(recipient);
    const messageIndex = conversation.findIndex((m) => m.timestamp === timestamp);
    if (messageIndex !== -1) {
      conversation[messageIndex].status = status;
      this.saveConversation(recipient);
      
      if (recipient === this.currentRecipient) {
        const $messageElement = $(`#chatBox [data-message-id="${timestamp}"]`);
        $messageElement.find('.message-status').text(status);
      }
    }
  }

  /**
   * Observes the visibility of a message element.
   * @param {HTMLElement} element - Message element to observe.
   * @param {Object} message - Message object associated with the element.
   */
  observeMessageVisibility(element, message) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.sendMessageSeenStatus(message);
          observer.disconnect();
        }
      });
    });

    observer.observe(element);
  }

  /**
   * Sends a message seen status to the server.
   * @param {Object} message - Message object that was seen.
   */
  sendMessageSeenStatus(message) {
    this.socket.emit('messageSeen', { sender: message.sender, timestamp: message.timestamp });
    this.updateMessageStatus(message.sender, message.timestamp, 'seen');
  }
}
