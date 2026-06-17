# OpenClaw对话轨迹可视化

使用 OpenClaw 的 webchat 对话时，如果刷新了页面或其他方面的原因，UI 界面的对话气泡框会只显示 tool 调用后的 ouput，tool的输入就会消失，这时候就无法清晰的知道 agent 到底干了什么。

本项目便可用于可视化 OpenClaw 会话的所有信息，即官方所谓的 trajectory。

这些信息存在了 Home 目录下的 `.openclaw/agents/main/sessions`，本项目会读取该目录下的所有记录并可视化。

## 使用
git clone 本仓库，在仓库目录下运行：
```bash
npm install
npm run dev
```
或者
```bash
npm install
npm build && npm start
```
默绑定本地的 3000 端口，访问 http://localhost:3000 即可进入。

## 界面展示

### 会话列表
<img width="1009" height="530" alt="image" src="https://github.com/user-attachments/assets/5a40a9bb-b543-43b2-b799-cd5214ccb9f1" />

### 会话详情
<img width="1009" height="749" alt="image" src="https://github.com/user-attachments/assets/07482637-996d-4d43-827a-f590c5552a78" />

### 轨迹详情
<img width="1009" height="1045" alt="image" src="https://github.com/user-attachments/assets/b1ad7a9a-7c75-4159-b409-17933415eed2" />
