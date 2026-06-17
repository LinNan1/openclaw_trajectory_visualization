import express from "express";
import ViteExpress from "vite-express";
import sessionRoutes from "./routes/sessionRoutes.js"
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import os from "os";

const app = express();

app.use(express.json());

app.get("/hello", (_, res) => {
  res.send("Hello Vite + React + TypeScript!");
});

app.use('/api/sessions', sessionRoutes)

// 使用 ViteExpress.listen 启动，获取 server 实例附加 WebSocket
const server = ViteExpress.listen(app, 3000, () => {
  console.log("Server is listening on port http://localhost:3000...");
});

// WebSocket 服务
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  if (pathname === '/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
})



// 存储每个 sessionId 对应的客户端连接
const sessionClients = new Map<string, Set<WebSocket>>();
// 存储监听会话列表的客户端（连接时未指定 sessionId）
const listClients = new Set<WebSocket>();
wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('sessionId');

  if (sessionId) {
    if (!sessionClients.has(sessionId)) {
      sessionClients.set(sessionId, new Set());
    }
    sessionClients.get(sessionId)!.add(ws);
  } else {
    // 未指定 sessionId 的客户端视为监听会话列表
    listClients.add(ws);
  }

  ws.on('close', () => {
    if (sessionId && sessionClients.has(sessionId)) {
      sessionClients.get(sessionId)!.delete(ws);
      if (sessionClients.get(sessionId)!.size === 0) {
        sessionClients.delete(sessionId);
      }
    } else {
      listClients.delete(ws);
    }
  });
});

// 监听 session 目录文件变化
const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');

function notifyClients(sessionId: string) {
  const clients = sessionClients.get(sessionId);
  if (clients) {
    const msg = JSON.stringify({ type: 'update', sessionId });
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  }
}

function notifyListClients() {
  const msg = JSON.stringify({ type: 'list_update' });
  for (const ws of listClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// 使用 fs.watch 监听文件变化（原生事件驱动，比轮询更及时）
if (fs.existsSync(SESSIONS_DIR)) {
  fs.watch(SESSIONS_DIR, (_eventType, filename) => {
    if (!filename) return;
    // 提取 sessionId（文件名格式：<sessionId>.jsonl 或 <sessionId>.jsonl.reset.<ts>）
    const sessionId = filename.toString().split('.jsonl')[0];
    if (sessionId) {
      notifyClients(sessionId);
    }
    // 任何文件变化都可能影响会话列表（新增/删除/状态变更）
    notifyListClients();
  });
}
