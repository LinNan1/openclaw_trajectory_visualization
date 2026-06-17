import express, { Request, Response } from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';

const router = express.Router();

// 默认会话文件路径
const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');

// 从 .jsonl 文件提取 session 元信息（首行 session + 第二行 model_change）
function parseSessionMeta(filePath: string): any {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return null;

    const firstLine = JSON.parse(lines[0]);
    if (firstLine.type !== 'session') return null;

    // 尝试从第二行读取 model_change 信息
    let modelId = '';
    let provider = '';
    if (lines.length > 1) {
      try {
        const secondLine = JSON.parse(lines[1]);
        if (secondLine.type === 'model_change') {
          modelId = secondLine.modelId || '';
          provider = secondLine.provider || '';
        }
      } catch {}
    }

    return {
      id: firstLine.id,
      timestamp: firstLine.timestamp,
      modelId,
      provider,
      hasModelChange: !!modelId,
    };
  } catch {
    return null;
  }
}

// 从 .jsonl 文件内容中解析 token 使用量（汇总所有 assistant 消息中的 usage）
function parseTokenUsage(filePath: string): { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number } | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;
    let hasUsage = false;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'message' && parsed.message?.role === 'assistant' && parsed.message?.usage) {
          const usage = parsed.message.usage;
          totalInput += usage.input || usage.inputTokens || 0;
          totalOutput += usage.output || usage.outputTokens || 0;
          if (usage.cost?.total) {
            totalCost += usage.cost.total;
          }
          hasUsage = true;
        }
      } catch {}
    }

    if (!hasUsage) return null;

    return {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      totalTokens: totalInput + totalOutput,
      estimatedCostUsd: totalCost,
    };
  } catch {
    return null;
  }
}



// 获取会话列表
router.get('/list', (req: Request, res: Response) => {
  try {
    // 1. 读取 sessions.json 中的统计数据，按 sessionId 建立索引
    const sessionsFilePath = path.join(SESSIONS_DIR, 'sessions.json');
    const statsById: Record<string, any> = {};
    if (fs.existsSync(sessionsFilePath)) {
      try {
        const content = fs.readFileSync(sessionsFilePath, 'utf-8');
        const raw = JSON.parse(content);
        for (const [key, value] of Object.entries(raw)) {
          if (value && typeof value === 'object') {
            const sid = (value as any).sessionId;
            if (sid) {
              statsById[sid] = value;
            }
          }
        }
      } catch {}
    }

    // 2. 扫描目录下所有 .jsonl、.jsonl.reset.* 和 .jsonl.lock 文件
    const files = fs.readdirSync(SESSIONS_DIR);
    const sessionFiles = files.filter(f =>
      f.endsWith('.jsonl') || f.match(/\.jsonl\.reset\./) || f.endsWith('.jsonl.lock')
    );

    const sessions: any[] = [];
    const seenSessionIds = new Set<string>();

    for (const file of sessionFiles) {
      const filePath = path.join(SESSIONS_DIR, file);
      const meta = parseSessionMeta(filePath);
      if (!meta) continue;

      const sessionId = meta.id;
      if (seenSessionIds.has(sessionId)) continue;
      seenSessionIds.add(sessionId);
      const stats = statsById[sessionId] || {};

      // 判断是否为 reset 文件
      const isReset = file.includes('.jsonl.reset.');
      const resetMatch = file.match(/\.jsonl\.reset\.(.+)$/);
      const resetTimestamp = resetMatch ? resetMatch[1] : null;

      // 判断状态：优先用 sessions.json 中的状态，否则根据文件内容推断
      let status = stats.status || '';
      if (!status) {
        if (isReset) {
          status = 'reset';
        } else if (!meta.hasModelChange) {
          status = 'new';
        } else {
          status = 'done';
        }
      }

      // 检查 lock 文件：如果存在 lock 文件，覆盖状态为 running
      const lockFilePath = path.join(SESSIONS_DIR, `${sessionId}.jsonl.lock`);
      if (fs.existsSync(lockFilePath)) {
        status = 'running';
      }

      // 如果 sessions.json 中没有 token 数据（如 reset 的 session），从 .jsonl 文件中解析
      let inputTokens = stats.inputTokens || null;
      let outputTokens = stats.outputTokens || null;
      let totalTokens = stats.totalTokens || null;
      let estimatedCostUsd = stats.estimatedCostUsd || null;

      if (!inputTokens && !outputTokens && !totalTokens) {
        const fileUsage = parseTokenUsage(filePath);
        if (fileUsage) {
          inputTokens = fileUsage.inputTokens;
          outputTokens = fileUsage.outputTokens;
          totalTokens = fileUsage.totalTokens;
          estimatedCostUsd = fileUsage.estimatedCostUsd;
        }
      }

      sessions.push({
        sessionId,
        sessionFile: file,
        isReset,
        resetTimestamp,
        model: stats.model || meta.modelId || '',
        modelProvider: stats.modelProvider || meta.provider || '',
        status,
        startedAt: stats.startedAt || new Date(meta.timestamp).getTime(),
        endedAt: stats.endedAt || null,
        runtimeMs: stats.runtimeMs || null,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
        chatType: stats.chatType || null,
        skillsSnapshot: stats.skillsSnapshot || null,
      });
    }

    // 按 startedAt 降序排列
    sessions.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));

    res.json({
      success: true,
      data: { sessions }
    });
  } catch (error) {
    console.error('Error reading sessions list:', error);
    res.status(500).json({ success: false, error: 'Failed to read sessions list' });
  }
})

router.get('/:id', (req: Request, res: Response) => {
  const sessionId = req.params.id as string;

  // 优先找 .jsonl，不存在则找 .jsonl.reset.* 文件
  let filePath = path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
  if (!fs.existsSync(filePath)) {
    const resetFiles = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.startsWith(`${sessionId}.jsonl.reset.`))
      .sort()
      .reverse();
    if (resetFiles.length > 0) {
      filePath = path.join(SESSIONS_DIR, resetFiles[0]);
    } else {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const rawMessages = lines.map(line => JSON.parse(line));

    // 将 toolCall 和 toolResult 配对
    // 遍历消息，将 toolResult 合并到对应的 assistant 消息中
    const pairedMessages: any[] = [];
    const toolResultMap = new Map<string, any>();

    // 第一遍：收集所有 toolResult
    for (const msg of rawMessages) {
      if (msg.type === 'message' && msg.message?.role === 'toolResult') {
        const toolCallId = msg.message.toolCallId;
        if (toolCallId) {
          toolResultMap.set(toolCallId, msg);
        }
      }
    }

    // 第二遍：构建配对后的消息列表
    for (const msg of rawMessages) {
      if (msg.type === 'message' && msg.message?.role === 'toolResult') {
        // toolResult 已通过配对处理，跳过
        continue;
      }

      if (msg.type === 'message' && msg.message?.role === 'assistant' && Array.isArray(msg.message.content)) {
        // 检查 assistant 消息中是否有 toolCall，将对应的 toolResult 附加到 toolCall 上
        const pairedContent = msg.message.content.map((item: any) => {
          if (item.type === 'toolCall') {
            const result = toolResultMap.get(item.id);
            return {
              ...item,
              result: result ? result.message : null
            };
          }
          return item;
        });

        pairedMessages.push({
          ...msg,
          message: {
            ...msg.message,
            content: pairedContent
          }
        });
      } else {
        pairedMessages.push(msg);
      }
    }

    // 判断是否为 reset 文件
    const isReset = path.basename(filePath).includes('.jsonl.reset.');

    res.json({
      success: true,
      data: {
        id: sessionId,
        isReset,
        messages: pairedMessages
      }
    });
  } catch (error) {
    console.error('Error reading session file:', error);
    res.status(500).json({ success: false, error: 'Failed to read session file' });
  }
});

// 获取轨迹数据 (trajectory.jsonl)
router.get('/:id/trajectory', (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.trajectory.jsonl`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Trajectory not found' });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const events = lines.map(line => JSON.parse(line));

    // 按 runId 分组，每 7 条事件为一轮 (session.started -> session.ended)
    const rounds: any[] = [];
    let currentRound: any[] = [];

    for (const event of events) {
      currentRound.push(event);
      if (event.type === 'session.ended') {
        rounds.push(currentRound);
        currentRound = [];
      }
    }

    res.json({
      success: true,
      data: {
        id: sessionId,
        rounds
      }
    });
  } catch (error) {
    console.error('Error reading trajectory file:', error);
    res.status(500).json({ success: false, error: 'Failed to read trajectory file' });
  }
});

// 执行 OpenClaw 命令
router.post('/:id/command', (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const { input } = req.body;

  if (!input || typeof input !== 'string' || input.trim() === '') {
    return res.status(400).json({ success: false, error: 'Input is required' });
  }

  // 使用 openclaw agent 命令向指定 session 发送消息
  const cmd = `openclaw agent --session-id ${sessionId} --message "${input.replace(/"/g, '\\"')}"`;

  exec(cmd, {
    timeout: 30000, // 30 秒超时
    maxBuffer: 1024 * 1024, // 1MB
  }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Command execution error: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: `Command failed: ${error.message}`,
        stderr: stderr || undefined,
      });
    }

    res.json({
      success: true,
      data: {
        stdout: stdout.trim(),
        stderr: stderr ? stderr.trim() : '',
      }
    });
  });
});

// 检测 session 是否正在运行（是否有 lock 文件）
router.get('/:id/lock', (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const lockFilePath = path.join(SESSIONS_DIR, `${sessionId}.jsonl.lock`);
  const isLocked = fs.existsSync(lockFilePath);
  res.json({ success: true, data: { locked: isLocked } });
});

// 删除 session 及其关联文件
router.delete('/:id', (req: Request, res: Response) => {
  const sessionId = req.params.id as string;
  const filesToDelete: string[] = [];

  // 查找所有关联文件
  const allFiles = fs.readdirSync(SESSIONS_DIR);
  for (const file of allFiles) {
    if (file.startsWith(sessionId)) {
      filesToDelete.push(path.join(SESSIONS_DIR, file));
    }
  }

  if (filesToDelete.length === 0) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  try {
    for (const filePath of filesToDelete) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true, data: { deletedFiles: filesToDelete.length } });
  } catch (error) {
    console.error('Error deleting session files:', error);
    res.status(500).json({ success: false, error: 'Failed to delete session files' });
  }
});

export default router