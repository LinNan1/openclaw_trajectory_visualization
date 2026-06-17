import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, MessageSquare, Clock, DollarSign, Zap, ChevronRight, Bot, Trash2, WifiOff } from 'lucide-react';


interface SessionInfo {
  sessionKey: string;
  sessionId: string;
  model: string;
  modelProvider: string;
  status: string;
  startedAt: number;
  endedAt: number;
  runtimeMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  chatType: string;
  lastChannel: string;
  skillsSnapshot: { skills: { name: string }[] };
  sessionFile: string;
}

export default function SessionList() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;
    const RECONNECT_BASE_DELAY = 1000;
    const RECONNECT_MAX_DELAY = 30000;

    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/sessions/list');
        const result = await res.json();
        if (result.success) {
          setSessions(result.data.sessions);
          setConnected(true);
          setError(null);
        } else {
          setError(result.error || 'Failed to load sessions');
          setConnected(false);
        }
      } catch (err) {
        setConnected(false);
        if (!loading) {
          setError('Network error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        reconnectAttempts = 0;
        fetchSessions();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'list_update') {
            fetchSessions();
          }
        } catch {}
      };

      ws.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        setConnected(false);
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

    fetchSessions();
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
  }, []);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hours}:${minutes}`;
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const min = Math.floor(ms / 60000);
    const sec = Math.round((ms % 60000) / 1000);
    return `${min}m ${sec}s`;
  };

  const formatCost = (usd: number) => {
    if (!usd) return '-';
    if (usd < 0.001) return `$${usd.toFixed(6)}`;
    if (usd < 0.01) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(3)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">完成</span>;
      case 'running':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>运行中</span>;
      case 'error':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">错误</span>;
      case 'new':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">新建</span>;
      case 'reset':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">已重置</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-zinc-500 font-medium">加载会话列表...</p>
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
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">OpenClaw 会话管理</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              共 {sessions.length} 个会话
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {connected ? (
              <>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs font-medium text-green-600 dark:text-green-400">实时</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-500 dark:text-red-400">连接断开</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Session List */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {sessions.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-zinc-500 dark:text-zinc-400">暂无会话记录</h3>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                onClick={() => navigate(`/session/${session.sessionId}`)}
                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  {/* Left: Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <Bot className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <span className="font-semibold text-zinc-900 dark:text-white truncate">
                        {session.model || 'Unknown Model'}
                      </span>
                      <span className="text-xs text-zinc-300 dark:text-zinc-600 font-mono hidden sm:inline">
                        {session.sessionId.slice(0, 8)}
                      </span>
                      {getStatusBadge(session.status)}
                    </div>

                    {/* Stats Row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {formatDate(session.startedAt)}
                      </span>
                      <span className="inline-flex items-center">
                        <Zap className="w-3.5 h-3.5 mr-1" />
                        {formatDuration(session.runtimeMs)}
                      </span>
                      <span className="inline-flex items-center">
                        <MessageSquare className="w-3.5 h-3.5 mr-1" />
                        {session.totalTokens?.toLocaleString() || '-'} tokens
                      </span>
                      <span className="inline-flex items-center">
                        <DollarSign className="w-3.5 h-3.5 mr-1" />
                        {formatCost(session.estimatedCostUsd)}
                      </span>
                    </div>

                    {/* Skills Tags */}
                    {session.skillsSnapshot?.skills && session.skillsSnapshot.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {session.skillsSnapshot.skills.slice(0, 6).map((skill) => (
                          <span
                            key={skill.name}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          >
                            {skill.name}
                          </span>
                        ))}
                        {session.skillsSnapshot.skills.length > 6 && (
                          <span className="text-xs text-zinc-400 dark:text-zinc-500 self-center">
                            +{session.skillsSnapshot.skills.length - 6}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDeletingId(session.sessionId);
                      }}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                      title="删除会话"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-zinc-400 text-xs">
          OpenClaw Trajectory Visualizer
        </p>
      </footer>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDeletingId(null)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-zinc-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">确认删除</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              确定删除会话 <code className="text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded text-xs font-mono">{deletingId.slice(0, 8)}...</code> 吗？此操作不可撤销。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  const res = await fetch(`/api/sessions/${deletingId}`, { method: 'DELETE' });
                  const result = await res.json();
                  if (result.success) {
                    setSessions(prev => prev.filter(s => s.sessionId !== deletingId));
                  }
                  setDeletingId(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}