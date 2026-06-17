import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageBubble } from '@client/components/MessageBubble';
import { Loader2, AlertCircle, ArrowLeft, Radio, Send, WifiOff } from 'lucide-react';

export default function Home() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [trajectoryRounds, setTrajectoryRounds] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // isLive 已移除，WebSocket 始终连接
  const [isReset, setIsReset] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [wsConnected, setWsConnected] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [sessionRes, trajectoryRes, lockRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/trajectory`),
        fetch(`/api/sessions/${sessionId}/lock`)
      ]);

      const sessionResult = await sessionRes.json();
      const trajectoryResult = await trajectoryRes.json();
      const lockResult = await lockRes.json();

      if (!sessionResult.success) {
        setError(sessionResult.error || 'Failed to load session');
        return;
      }

      const msgs = sessionResult.data.messages;
      setMessages(msgs);
      setIsReset(sessionResult.data.isReset || false);

      if (lockResult.success) {
        setLocked(lockResult.data.locked);
      }

      if (trajectoryResult.success) {
        const rounds = trajectoryResult.data.rounds;
        setTrajectoryRounds(rounds);
      }
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // 初始加载
  useEffect(() => {
    if (!sessionId) return;
    fetchData();
  }, [sessionId, fetchData]);

  // WebSocket 连接：文件有变动时自动刷新，支持断线重连
  useEffect(() => {
    if (!sessionId) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_BASE_DELAY = 1000;
    const RECONNECT_MAX_DELAY = 30000;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?sessionId=${sessionId}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttempts = 0;
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'update' && data.sessionId === sessionId) {
            fetchData();
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        setWsConnected(false);
        // onerror 后必定 onclose，由 onclose 触发重连
      };
    };

    const scheduleReconnect = () => {
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
      const delay = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts),
        RECONNECT_MAX_DELAY
      );
      reconnectAttempts++;
      reconnectTimer = setTimeout(() => {
        connectWs();
      }, delay);
    };

    connectWs();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [sessionId, fetchData]);

  // 有新消息时自动滚动到底部
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  // 将 trajectory rounds 分配到对应的 assistant 消息上
  // 只在该轮最后一条非用户消息上返回 round 数据
  const getTrajectoryRound = (msgIndex: number): any[] | undefined => {
    if (trajectoryRounds.length === 0) return undefined;
    if (msgIndex >= messages.length) return undefined;

    const msg = messages[msgIndex];
    // 只对非用户消息分配 round
    if (msg.type !== 'message' || msg.message?.role === 'user') return undefined;

    // 收集所有"有效"用户消息的索引（跳过 /reset、/clear 等命令）
    const userMsgIndices: number[] = [];
    messages.forEach((m, idx) => {
      if (m.type === 'message' && m.message?.role === 'user') {
        const text = typeof m.message.content === 'string'
          ? m.message.content
          : Array.isArray(m.message.content)
            ? m.message.content.map((c: any) => c.text || '').join('')
            : '';
        // 跳过 /reset、/clear 等系统命令，它们不产生 trajectory
        if (text.startsWith('/reset') || text.startsWith('/clear')) return;
        userMsgIndices.push(idx);
      }
    });

    // 找到当前消息属于哪个用户消息之后（即第几轮）
    let roundIndex = -1;
    for (let i = userMsgIndices.length - 1; i >= 0; i--) {
      if (msgIndex >= userMsgIndices[i]) {
        roundIndex = i;
        break;
      }
    }

    if (roundIndex < 0) return undefined;

    // trajectoryRounds 可能比有效用户消息轮次少（最后一轮可能还没结束）
    if (roundIndex >= trajectoryRounds.length) return undefined;

    // 检查是否是本轮的最后一个非用户消息
    // 查找从 msgIndex 到下一个有效用户消息（或末尾）之间是否还有非用户消息
    const nextUserIdx = userMsgIndices.find(idx => idx > msgIndex) ?? messages.length;
    for (let i = msgIndex + 1; i < nextUserIdx; i++) {
      const nextMsg = messages[i];
      if (nextMsg.type === 'message' && nextMsg.message?.role !== 'user') {
        return undefined; // 后面还有同轮的非用户消息，不是最后一条
      }
    }

    return trajectoryRounds[roundIndex];
  };

  // 发送输入到 OpenClaw
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || !sessionId || sending) {
      if (!text) {
        inputRef.current?.focus();
      }
      return;
    }

    setSending(true);
    setInputValue('');

    try {
      const res = await fetch(`/api/sessions/${sessionId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text }),
      });

      const result = await res.json();

      if (!result.success) {
        console.error('Send command failed:', result.error);
      }

      // 发送 /reset 或 /clear 后，跳转到最新创建的 session
      if (text === '/reset' || text === '/clear') {
        // 等待一小段时间让后端完成文件写入
        await new Promise(r => setTimeout(r, 500));
        const listRes = await fetch('/api/sessions/list');
        const listResult = await listRes.json();
        if (listResult.success && listResult.data.sessions.length > 0) {
          const latestSession = listResult.data.sessions[0];
          if (latestSession.sessionId !== sessionId) {
            navigate(`/session/${latestSession.sessionId}`, { replace: true });
            return;
          }
        }
      }

      // 发送成功后立即拉取最新数据
      // await fetchData();
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
      // 聚焦回输入框
      inputRef.current?.focus();
    }
  }, [inputValue, sessionId, sending, fetchData, navigate]);

  // Enter 发送，Shift+Enter 换行
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-zinc-500 font-medium">正在加载对话轨迹...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-red-800 dark:text-red-400 mb-2">加载失败</h2>
          <p className="text-red-600 dark:text-red-300 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-medium"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">返回</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-white">OpenClaw 对话轨迹</h1>
              <p className="text-xs text-zinc-500 mt-0.5 font-mono">Session ID: {sessionId}</p>
            </div>
          </div>
          {!isReset && (
            <div className="flex items-center space-x-3">
              {wsConnected ? (
                <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>实时更新中</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>连接断开，正在重连...</span>
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Chat Container */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-28">
        <div className="flex flex-col">
          {messages.map((msg, index) => {
            const currentRound = getTrajectoryRound(index);
            const isLastInRound = currentRound !== undefined;
            return (
              <MessageBubble
                key={index}
                message={msg}
                trajectoryRound={currentRound}
                isLastInRound={isLastInRound}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input Area - 已重置的会话不显示输入框 */}
      {!isReset && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center space-x-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={locked ? "OpenClaw 运行中..." : "输入消息发送到 OpenClaw... (Enter 发送，Shift+Enter 换行)"}
              disabled={sending || locked}
              rows={1}
              className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:opacity-50 transition-colors resize-none"
               style={{ overflow: 'hidden' }}
               onInput={(e) => {
                 const el = e.currentTarget;
                 el.style.height = 'auto';
                 const newHeight = Math.min(el.scrollHeight, 200);
                 el.style.height = newHeight + 'px';
                 el.style.overflow = newHeight >= 200 ? 'auto' : 'hidden';
               }}
            />
            <button
              onClick={handleSend}
              disabled={sending || locked}
              className={`flex items-center justify-center w-10 h-10 text-white rounded-xl transition-colors disabled:cursor-not-allowed ${
                sending
                  ? 'bg-zinc-300 dark:bg-zinc-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {sending || locked ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
