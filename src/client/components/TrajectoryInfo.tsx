import React from 'react';
import { Info, Clock, Cpu, Database, Zap, CheckCircle, XCircle, MessageSquare, Brain, Wrench, ChevronRight, X, ArrowDown, Layers, Code, FileText } from 'lucide-react';
import { JsonTree } from './JsonTree';

interface TrajectoryEvent {
  type: string;
  ts: string;
  seq: number;
  sourceSeq: number;
  runId: string;
  data?: any;
}

interface TrajectoryInfoProps {
  round: TrajectoryEvent[];
}

function formatDuration(startTs: string, endTs: string): string {
  const start = new Date(startTs).getTime();
  const end = new Date(endTs).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getUsageInfo(events: TrajectoryEvent[]) {
  const modelCompleted = events.find(e => e.type === 'model.completed');
  if (!modelCompleted?.data?.usage) return null;
  return modelCompleted.data.usage;
}

function getPromptCache(events: TrajectoryEvent[]) {
  const modelCompleted = events.find(e => e.type === 'model.completed');
  return modelCompleted?.data?.promptCache || null;
}

function getCompactionCount(events: TrajectoryEvent[]) {
  const modelCompleted = events.find(e => e.type === 'model.completed');
  return modelCompleted?.data?.compactionCount;
}

function getToolMetas(events: TrajectoryEvent[]) {
  const artifacts = events.find(e => e.type === 'trace.artifacts');
  return artifacts?.data?.toolMetas || [];
}

function getFinalStatus(events: TrajectoryEvent[]) {
  const artifacts = events.find(e => e.type === 'trace.artifacts');
  return artifacts?.data?.finalStatus;
}

function getModelInfo(events: TrajectoryEvent[]) {
  const started = events.find(e => e.type === 'session.started');
  if (!started) return null;
  return { provider: (started as any).provider, modelId: (started as any).modelId };
}

function getContextCompiled(events: TrajectoryEvent[]) {
  return events.find(e => e.type === 'context.compiled');
}

function getModelCompleted(events: TrajectoryEvent[]) {
  return events.find(e => e.type === 'model.completed');
}

function getPromptSubmitted(events: TrajectoryEvent[]) {
  return events.find(e => e.type === 'prompt.submitted');
}

function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function MessagePreview({ role, content }: { role: string; content: any }) {
  const roleColors: Record<string, string> = {
    user: 'text-blue-600 dark:text-blue-400',
    assistant: 'text-emerald-600 dark:text-emerald-400',
    toolResult: 'text-amber-600 dark:text-amber-400',
    system: 'text-purple-600 dark:text-purple-400',
  };
  const roleLabels: Record<string, string> = {
    user: '用户',
    assistant: '助手',
    toolResult: '工具',
    system: '系统',
  };

  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = content.map((c: any) => {
      if (c.type === 'text') return c.text || '';
      if (c.type === 'thinking') return '💭 ' + (c.thinking || '');
      if (c.type === 'toolCall') return `🔧 ${c.name || 'tool_call'}(${truncate(JSON.stringify(c.arguments || {}), 60)})`;
      if (c.type === 'toolResult') return `📎 ${truncate(c.text || '', 80)}`;
      return JSON.stringify(c);
    }).filter(Boolean).join('\n');
  }

  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`shrink-0 text-xs font-mono w-10 ${roleColors[role] || 'text-zinc-500'}`}>
        {roleLabels[role] || role}
      </span>
      <span className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
        {truncate(text, 200)}
      </span>
    </div>
  );
}

function FlowStep({ icon, label, detail, children }: { icon: React.ReactNode; label: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
          {icon}
        </div>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
        {detail && <span className="text-[10px] text-zinc-400">{detail}</span>}
      </div>
      {children && (
        <div className="ml-7 pl-3 border-l-2 border-zinc-100 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}

export const TrajectoryInfo: React.FC<TrajectoryInfoProps> = ({ round }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const startEvent = round[0];
  const endEvent = round[round.length - 1];
  const duration = formatDuration(startEvent.ts, endEvent.ts);
  const usage = getUsageInfo(round);
  const promptCache = getPromptCache(round);
  const compactionCount = getCompactionCount(round);
  const toolMetas = getToolMetas(round);
  const finalStatus = getFinalStatus(round);
  const modelInfo = getModelInfo(round);
  const contextCompiled = getContextCompiled(round);
  const modelCompleted = getModelCompleted(round);
  const promptSubmitted = getPromptSubmitted(round);

  const systemPrompt = contextCompiled?.data?.systemPrompt || '';
  const userPrompt = contextCompiled?.data?.prompt || promptSubmitted?.data?.prompt || '';
  const tools = contextCompiled?.data?.tools || [];
  const messagesSnapshot = modelCompleted?.data?.messagesSnapshot || [];
  const finalPromptText = modelCompleted?.data?.finalPromptText || '';
  const compiledMessages = contextCompiled?.data?.messages || [];

  // Close on Escape & prevent background scroll
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium
          bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400
          hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      >
        <Info size={10} />
        <span>{duration}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onWheel={(e) => e.stopPropagation()}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />

          {/* Modal */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full max-w-2xl max-h-[85vh] flex flex-col mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-zinc-800 dark:text-zinc-200">轨迹详情</span>
                {finalStatus === 'success' ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                    <CheckCircle size={12} /> 成功
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                    <XCircle size={12} /> {finalStatus || '未知'}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Duration & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <Clock size={14} className="shrink-0" />
                  <span>耗时: <strong className="text-zinc-800 dark:text-zinc-200">{duration}</strong></span>
                </div>
                {modelInfo && (
                  <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <Cpu size={14} className="shrink-0" />
                    <span>模型: <strong className="text-zinc-800 dark:text-zinc-200">{modelInfo.modelId}</strong></span>
                    <span className="text-zinc-400">({modelInfo.provider})</span>
                  </div>
                )}
              </div>

              {/* Token Usage */}
              {usage && (
                <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-zinc-500 mb-3">
                    <Zap size={14} />
                    <span className="text-sm font-medium">Token 用量</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm text-zinc-600 dark:text-zinc-400">
                    <span>输入: <strong className="text-zinc-800 dark:text-zinc-200">{usage.input?.toLocaleString()}</strong></span>
                    <span>输出: <strong className="text-zinc-800 dark:text-zinc-200">{usage.output?.toLocaleString()}</strong></span>
                    <span>缓存读取: <strong className="text-zinc-800 dark:text-zinc-200">{usage.cacheRead?.toLocaleString()}</strong></span>
                    <span>推理 Token: <strong className="text-zinc-800 dark:text-zinc-200">{usage.reasoningTokens?.toLocaleString()}</strong></span>
                  </div>
                  {promptCache && (
                    <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-1.5 text-zinc-400 mb-2">
                        <Zap size={12} />
                        <span className="text-xs font-medium text-zinc-500">Prompt Cache</span>
                      </div>
                      <div className="grid grid-cols-2 gap-y-1 gap-x-6 text-xs text-zinc-500">
                        <span>上次缓存命中: <strong className="text-zinc-700 dark:text-zinc-300">{promptCache.lastCallUsage?.cacheRead?.toLocaleString() || 0}</strong></span>
                        <span>上次缓存写入: <strong className="text-zinc-700 dark:text-zinc-300">{promptCache.lastCallUsage?.cacheWrite?.toLocaleString() || 0}</strong></span>
                      </div>
                    </div>
                  )}
                  {compactionCount !== undefined && compactionCount !== null && (
                    <div className="mt-2 text-xs text-zinc-400">
                      上下文压缩次数: <strong className="text-zinc-600 dark:text-zinc-400">{compactionCount}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Tool Calls */}
              {toolMetas.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-zinc-500 mb-2">
                    <Database size={14} />
                    <span className="text-sm font-medium">工具调用</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {toolMetas.map((tm: any, idx: number) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {tm.toolName}
                        {tm.meta && <span className="text-zinc-400">— {tm.meta}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* LLM Interaction Flow */}
              <div>
                <div className="flex items-center gap-1.5 text-zinc-500 mb-4">
                  <Brain size={14} />
                  <span className="text-sm font-medium">LLM 交互流程</span>
                </div>

                <div className="space-y-3">
                  {/* Step 1: User Input */}
                  <FlowStep icon={<MessageSquare size={12} />} label="用户输入" detail={userPrompt ? `"${truncate(userPrompt, 60)}"` : undefined}>
                    {userPrompt && (
                      <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 mt-1 max-h-16 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
                        {userPrompt}
                      </pre>
                    )}
                  </FlowStep>

                  <div className="flex justify-center text-zinc-300 dark:text-zinc-600">
                    <ArrowDown size={14} />
                  </div>

                  {/* Step 2: Context Compilation */}
                  <FlowStep icon={<Layers size={12} />} label="上下文编译" detail={`${tools.length} 个工具 · ${compiledMessages.length} 条历史消息`}>
                    <details className="mt-1" open>
                      <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none">
                        System Prompt <span className="text-zinc-300">({systemPrompt.length} 字符)</span>
                      </summary>
                      <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
                        {systemPrompt}
                      </pre>
                    </details>

                    {compiledMessages.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none">
                          历史消息 <span className="text-zinc-300">({compiledMessages.length} 条)</span>
                        </summary>
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 mt-1 max-h-40 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                          {compiledMessages.map((msg: any, idx: number) => (
                            <MessagePreview key={idx} role={msg.role} content={msg.content} />
                          ))}
                        </div>
                      </details>
                    )}

                    {tools.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none">
                          工具定义 <span className="text-zinc-300">({tools.length} 个)</span>
                        </summary>
                        <div className="space-y-1 mt-1">
                          {tools.map((tool: any, idx: number) => (
                            <details key={idx} className="bg-zinc-50 dark:bg-zinc-800/50 rounded">
                              <summary className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 select-none px-2 py-1">
                                {tool.name}
                              </summary>
                              <div className="px-2 pb-1.5 space-y-0.5">
                                <p className="text-[11px] text-zinc-400 leading-relaxed">{truncate(tool.description || '', 300)}</p>
                                {tool.parameters?.properties && (
                                  <div className="text-[11px] text-zinc-500">
                                    {Object.entries(tool.parameters.properties).map(([key, val]: [string, any]) => (
                                      <div key={key} className="flex gap-2">
                                        <span className="font-mono text-zinc-600 dark:text-zinc-400">{key}</span>
                                        <span className="text-zinc-400">({val.type || 'any'})</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    )}
                  </FlowStep>

                  <div className="flex justify-center text-zinc-300 dark:text-zinc-600">
                    <ArrowDown size={14} />
                  </div>

                  {/* Step 3: Send to LLM */}
                  <FlowStep icon={<Code size={12} />} label="发送给 LLM" detail={`${usage?.input?.toLocaleString() || '?'} 输入 tokens`}>
                    {/* Integrated final payload */}
                    <details className="mt-1" open>
                      <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none">
                        整合的最终输入 <span className="text-zinc-300">(API 请求体)</span>
                      </summary>
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 mt-1 max-h-60 overflow-auto">
                        <JsonTree data={{ messages: messagesSnapshot, tools: tools.length > 0 ? tools.map((t: any) => ({ name: t.name, description: t.description })) : undefined }} />
                      </div>
                    </details>

                    {finalPromptText && finalPromptText !== userPrompt && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none">
                          最终 Prompt 文本 <span className="text-zinc-300">({finalPromptText.length} 字符)</span>
                        </summary>
                        <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all leading-relaxed">
                          {finalPromptText}
                        </pre>
                      </details>
                    )}

                    {messagesSnapshot.length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none">
                          逐条消息查看 <span className="text-zinc-300">({messagesSnapshot.length} 条)</span>
                        </summary>
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-2 mt-1 max-h-60 overflow-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                          {messagesSnapshot.map((msg: any, idx: number) => {
                            // Determine source annotation
                            let sourceTag = '';
                            let sourceColor = '';
                            if (msg.role === 'system') {
                              sourceTag = 'System Prompt';
                              sourceColor = 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
                            } else if (idx === messagesSnapshot.length - 1 && msg.role === 'user') {
                              sourceTag = '本轮输入';
                              sourceColor = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
                            } else if (msg.role === 'user') {
                              sourceTag = '历史用户消息';
                              sourceColor = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400';
                            } else if (msg.role === 'assistant') {
                              sourceTag = '历史助手回复';
                              sourceColor = 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
                            } else if (msg.role === 'tool') {
                              sourceTag = '历史工具结果';
                              sourceColor = 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
                            }
                            return (
                              <div key={idx} className="py-1.5 first:pt-0 last:pb-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <MessagePreview role={msg.role} content={msg.content} />
                                  {sourceTag && (
                                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sourceColor}`}>
                                      {sourceTag}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </FlowStep>

                  <div className="flex justify-center text-zinc-300 dark:text-zinc-600">
                    <ArrowDown size={14} />
                  </div>

                  {/* Step 4: LLM Response */}
                  <FlowStep icon={<FileText size={12} />} label="LLM 响应" detail={`${usage?.output?.toLocaleString() || '?'} 输出 tokens`}>
                    <div className="mt-1 text-xs text-zinc-500">
                      {usage?.reasoningTokens ? (
                        <span>包含 <strong className="text-zinc-700 dark:text-zinc-300">{usage.reasoningTokens.toLocaleString()}</strong> 推理 tokens</span>
                      ) : (
                        <span className="text-zinc-400">无推理过程</span>
                      )}
                      {promptCache?.lastCallUsage?.cacheRead ? (
                        <span className="ml-3">缓存命中 <strong className="text-zinc-700 dark:text-zinc-300">{promptCache.lastCallUsage.cacheRead.toLocaleString()}</strong> tokens</span>
                      ) : null}
                    </div>
                  </FlowStep>
                </div>
              </div>

              {/* Events Timeline */}
              <details className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none">
                  事件流水线 ({round.length} 步)
                </summary>
                <div className="mt-2 space-y-1">
                  {round.map((event, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
                      <span className="font-mono text-zinc-600 dark:text-zinc-400">{event.type}</span>
                      <span className="text-zinc-400">{new Date(event.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </>
  );
};