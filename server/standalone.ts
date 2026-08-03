import { WebSocketServer } from 'ws';
import { createServer } from 'http';
// Note: Ensure octagon.ts exists and exports attachOctagon
// import { attachOctagon } from './octagon'; 

const PORT = process.env.PORT || 8080;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Server is running.');
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  console.log('🔌 New connection:', req.socket.remoteAddress);
  ws.on('error', (err) => {
    console.error('❌ WS Error:', err);
    ws.close();
  });
});

// TODO: Import and attach your game logic here
// attachOctagon(wss, server);

server.listen(PORT, () => {
  console.log(`🚀 WebSocket Server running on port ${PORT}`);
});
