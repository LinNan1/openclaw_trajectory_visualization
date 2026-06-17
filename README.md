# OpenClaw 对话轨迹可视化

使用 OpenClaw 的 webchat 进行对话时，如果刷新页面或切换会话，UI 界面上仅显示 tool 调用后的输出，tool 的输入会消失，导致无法清晰追踪 agent 的执行过程。

本项目用于可视化 OpenClaw 会话的完整信息（即官方所称的 trajectory），包括每条消息、tool 调用链及运行轨迹。

会话数据存储在 `~/.openclaw/agents/main/sessions/` 目录下，本项目会读取该目录下的所有记录并提供可视化界面。

## 功能特性

- **会话列表** — 展示所有历史会话，支持按状态筛选、删除会话
- **会话详情** — 以对话气泡形式展示完整消息记录
- **轨迹可视化** — 展示每条 assistant 消息背后的 tool 调用链（trajectory）
- **实时更新** — 通过 WebSocket 自动监听会话变更，新消息即时推送
- **断线重连** — WebSocket 断开后自动指数退避重连，并在界面提示连接状态
- **输入交互** — 支持在详情页直接向 OpenClaw 发送消息（Enter 发送，Shift+Enter 换行）
- **深色模式** — 跟随系统深色/浅色主题自动切换

## 使用

```bash
# 克隆仓库
git clone <repo-url>
cd openclaw_trajectory_visualization

# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 生产构建并启动
npm run build && npm start
```

默认绑定 `localhost:3000`，访问 http://localhost:3000 即可进入。

## 界面展示

### 会话列表
<img width="1009" alt="会话列表" src="https://github.com/user-attachments/assets/5a40a9bb-b543-43b2-b799-cd5214ccb9f1" />

### 会话详情
<img width="1009" alt="会话详情" src="https://github.com/user-attachments/assets/07482637-996d-4d43-827a-f590c5552a78" />

### 轨迹详情
<img width="1009" alt="轨迹详情" src="https://github.com/user-attachments/assets/b1ad7a9a-7c75-4159-b409-17933415eed2" />

## 技术栈

- **前端** — React + TypeScript + Vite + Tailwind CSS
- **后端** — Node.js + Express
- **实时通信** — WebSocket
