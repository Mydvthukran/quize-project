import http from 'node:http';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import { app } from './app.js';
import { setupQuizSocket } from './services/socketService.js';

dotenv.config();

const port = Number(process.env.PORT || 5000);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
});

setupQuizSocket(io);

server.listen(port, () => {
  console.log(`LearnLoop backend running on http://localhost:${port}`);
});
