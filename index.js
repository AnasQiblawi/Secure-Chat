const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const users = new Map();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'login.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'chat.html'));
});

app.get('/user/:username', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'html', 'user-profile.html'));
});

app.get('/api/user/:username', (req, res) => {
  const { username } = req.params;
  const user = users.get(username);
  if (user) {
    res.json({ username, publicKey: user.publicKey });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

io.on('connection', (socket) => {
  let currentUser;

  socket.on('join', ({ username, publicKey, isHidden }) => {
    currentUser = username;
    users.set(username, { publicKey, isHidden, socket: socket.id });
    socket.join(username);
    io.emit('userList', Array.from(users.entries()).map(([username, data]) => ({
      username,
      publicKey: data.publicKey,
      isOnline: true,
      isHidden: data.isHidden
    })));
  });

  socket.on('typing', ({ recipient, isTyping }) => {
    if (users.has(recipient)) {
      const recipientSocket = users.get(recipient).socket;
      io.to(recipientSocket).emit('userTyping', { sender: currentUser, isTyping });
    }
  });

  socket.on('sendMessage', ({ recipient, encryptedPackage }) => {
    if (users.has(recipient)) {
      const recipientSocket = users.get(recipient).socket;
      io.to(recipientSocket).emit('receiveMessage', encryptedPackage);
      socket.emit('messageSent', { recipient, timestamp: encryptedPackage.timestamp });
    }
  });

  socket.on('messageDelivered', ({ sender, timestamp }) => {
    if (users.has(sender)) {
      const senderSocket = users.get(sender).socket;
      io.to(senderSocket).emit('messageDeliveryStatus', { recipient: currentUser, timestamp, status: 'delivered' });
    }
  });

  socket.on('messageSeen', ({ sender, timestamp }) => {
    if (users.has(sender)) {
      const senderSocket = users.get(sender).socket;
      io.to(senderSocket).emit('messageSeenStatus', { recipient: currentUser, timestamp });
    }
  });

  socket.on('messageRead', ({ sender, timestamp }) => {
    if (users.has(sender)) {
      const senderSocket = users.get(sender).socket;
      io.to(senderSocket).emit('messageDeliveryStatus', { recipient: currentUser, timestamp, status: 'read' });
    }
  });

  socket.on('toggleHidden', (isHidden) => {
    if (currentUser) {
      users.get(currentUser).isHidden = isHidden;
      io.emit('userList', Array.from(users.entries()).map(([username, data]) => ({
        username,
        publicKey: data.publicKey,
        isOnline: true,
        isHidden: data.isHidden
      })));
    }
  });

  socket.on('disconnect', () => {
    if (currentUser) {
      users.delete(currentUser);
      io.emit('userList', Array.from(users.entries()).map(([username, data]) => ({
        username,
        publicKey: data.publicKey,
        isOnline: true,
        isHidden: data.isHidden
      })));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});