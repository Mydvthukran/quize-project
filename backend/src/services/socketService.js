import { db } from '../data/store.js';

export function setupQuizSocket(io) {
  io.on('connection', (socket) => {
    socket.on('room:create', ({ roomName, host }) => {
      const roomId = `room-${Math.random().toString(36).slice(2, 8)}`;
      db.rooms.set(roomId, {
        id: roomId,
        roomName,
        host,
        players: [{ id: socket.id, name: host }],
        started: false,
      });
      socket.join(roomId);
      socket.emit('room:created', db.rooms.get(roomId));
    });

    socket.on('room:join', ({ roomId, playerName }) => {
      const room = db.rooms.get(roomId);
      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      socket.join(roomId);
      room.players.push({ id: socket.id, name: playerName });
      io.to(roomId).emit('room:update', room);
    });

    socket.on('room:start', ({ roomId }) => {
      const room = db.rooms.get(roomId);
      if (!room) return;
      room.started = true;
      io.to(roomId).emit('room:started', room);
    });

    socket.on('disconnect', () => {
      for (const [roomId, room] of db.rooms.entries()) {
        room.players = room.players.filter((player) => player.id !== socket.id);
        if (!room.players.length) {
          db.rooms.delete(roomId);
        } else {
          io.to(roomId).emit('room:update', room);
        }
      }
    });
  });
}
