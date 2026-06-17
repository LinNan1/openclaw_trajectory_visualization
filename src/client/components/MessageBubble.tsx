import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Wrench, Brain, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@client/lib/utils';
import { TrajectoryInfo } from './TrajectoryInfo';
import { JsonTree } from './JsonTree';

// 将 YAML frontmatter 风格的元数据块（--- 包裹的内容）转换为 markdown 表格
function preprocessYamlFrontmatter(text: string): string {
  // 匹配以 --- 开头和结尾的元数据块
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = text.match(frontmatterRegex);
  if (!match) return text;

  const yamlLines = match[1].trim().split('\n');
  const rows: string[] = [];

  for (const line of yamlLines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    rows.push(`| **${key}** | ${value} |`);
  }

  if (rows.length === 0) return text;

  const table = ['| 属性 | 值 |', '| --- | --- |', ...rows].join('\n');
  const rest = text.slice(match[0].length);
  return table + '\n\n' + rest;
}

interface MessageBubbleProps {
  message: any;
  trajectoryRound?: any[];
  isLastInRound?: boolean;
}

const COLLAPSE_THRESHOLD = 300; // 超过此字符数则折叠

function CollapsibleText({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const shouldCollapse = text.length > COLLAPSE_THRESHOLD;

  if (!shouldCollapse) {
    return <div className={className}>{text}</div>;
  }

  return (
    <div>
      <div className={cn(className, !expanded && "line-clamp-6")}>
        {text}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
      >
        <ChevronsUpDown size={12} />
        {expanded ? '收起' : `展开全部 (${text.length} 字符)`}
      </button>
    </div>
  );
}

function ExecOutput({ text }: { text: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const shouldCollapse = text.length > COLLAPSE_THRESHOLD;

  return (
    <div>
      <pre className={cn(
        "p-2 bg-zinc-900 dark:bg-black text-green-400 dark:text-green-300 font-mono text-xs rounded-lg overflow-x-auto whitespace-pre-wrap",
        shouldCollapse && !expanded && "max-h-24 overflow-y-hidden"
      )}>
        <span className="text-zinc-500 select-none">$ </span>{text}
      </pre>
      {shouldCollapse && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-0.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
        >
          <ChevronsUpDown size={11} />
          {expanded ? '收起' : `展开全部 (${text.length} 字符)`}
        </button>
      )}
    </div>
  );
}

function ToolCallBlock({ item }: { item: any }) {
  const [expanded, setExpanded] = React.useState(false);

  // 获取折叠时显示的摘要信息
  const getSummary = () => {
    const args = item.arguments || {};
    if (item.name === 'read') {
      return args.path || args.file_path || '';
    }
    if (item.name === 'exec') {
      return args.command || '';
    }
    return '';
  };

  const summary = getSummary();

  return (
    <div className="mt-0.5">
      {/* Tool Call Card */}
      <div className="p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
            <div className="flex items-center gap-1 min-w-0">
              <Wrench size={11} className="shrink-0" />
              <span className="shrink-0">工具调用: {item.name}</span>
              {!expanded && summary && (
                <span className="font-mono text-zinc-400 truncate ml-1">
                  {summary}
                </span>
              )}
            </div>
            {expanded ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
          </div>
        </button>
        {expanded && (
          <pre className="text-xs font-mono overflow-x-auto text-zinc-600 dark:text-zinc-400 mt-1">
            {JSON.stringify(item.arguments, null, 2)}
          </pre>
        )}
      </div>
      {/* Paired Tool Result */}
      {item.result && (
        <ToolResultBlock item={item} />
      )}
    </div>
  );
}

function ToolResultBlock({ item }: { item: any }) {
  const [expanded, setExpanded] = React.useState(false);

  const resultContent = item.result.content;
  const resultToolName = item.result.toolName || item.name;
  const isMarkdown = resultToolName === 'read';
  const resultText = Array.isArray(resultContent)
    ? resultContent.map((c: any) => c.text || '').join('\n')
    : typeof resultContent === 'string'
      ? resultContent
      : JSON.stringify(resultContent, null, 2);

  // 检测是否为 JSON 格式
  let isJson = false;
  let jsonData: any = null;
  if (!isMarkdown) {
    try {
      const trimmed = resultText.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        jsonData = JSON.parse(trimmed);
        isJson = true;
      }
    } catch {}
  }

  // read 工具的输出渲染 markdown，默认折叠
  if (isMarkdown) {
    return (
      <div className="ml-2 mt-0.5 pl-2 border-l-2 border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left"
        >
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400 dark:text-zinc-500">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 mr-1"></span>
              输出结果
            </div>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </button>
        {expanded && (
          <div className="mt-0.5 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {preprocessYamlFrontmatter(resultText)}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ml-2 mt-0.5 pl-2 border-l-2 border-zinc-200 dark:border-zinc-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between text-xs font-medium text-zinc-400 dark:text-zinc-500">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 mr-1"></span>
            输出结果
          </div>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>
      {expanded && (
        <div className="mt-0.5">
          {isJson && jsonData ? (
            <div className="text-xs">
              <JsonTree data={jsonData} />
            </div>
          ) : resultToolName === 'exec' ? (
            <ExecOutput text={resultText} />
          ) : (
            <CollapsibleText
              text={resultText}
              className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400 font-mono text-xs"
            />
          )}
        </div>
      )}
    </div>
  );
}

const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    // 有 className（即使不匹配语言）或内容含换行 → 代码块；否则 → 行内代码
    const isInline = !className && !match && String(children).indexOf('\n') === -1;
    if (isInline) {
      return (
        <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-zinc-700 dark:text-zinc-300" {...props}>
          {children}
        </code>
      );
    }
    const lang = match ? match[1] : 'text';
    return (
      <div className="my-1">
        <div className="relative group">
          <div className="absolute top-0 right-0 px-2 py-0.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-200 dark:bg-zinc-700 rounded-bl-lg rounded-tr-lg select-none">
            {lang}
          </div>
          <pre className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2 pt-1 overflow-x-auto text-sm font-mono border border-zinc-200 dark:border-zinc-700">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      </div>
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  strong({ children }) {
    return <strong className="font-bold text-zinc-900 dark:text-zinc-100">{children}</strong>;
  },
  ul({ children }) {
    return <ul className="list-disc list-inside space-y-0.5 my-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside space-y-0.5 my-0.5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-zinc-700 dark:text-zinc-300">{children}</li>;
  },
  h1({ children }) {
    return <h1 className="text-lg font-bold mt-2 mb-1 text-zinc-900 dark:text-zinc-100">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-bold mt-1 mb-0.5 text-zinc-900 dark:text-zinc-100">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-bold mt-1 mb-0.5 text-zinc-900 dark:text-zinc-100">{children}</h3>;
  },
  p({ children }) {
    return <p className="mb-0.5 last:mb-0 text-zinc-700 dark:text-zinc-300">{children}</p>;
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300">
        {children}
      </a>
    );
  },
  hr() {
    return <hr className="my-2 border-zinc-200 dark:border-zinc-700" />;
  },
  blockquote({ children }) {
    return <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-3 my-1 italic text-zinc-600 dark:text-zinc-400">{children}</blockquote>;
  },
  table({ children }) {
    return (
      <div className="my-2 overflow-x-auto">
        <table className="min-w-full border-collapse border border-zinc-200 dark:border-zinc-700 text-sm">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-zinc-100 dark:bg-zinc-800">{children}</thead>;
  },
  tbody({ children }) {
    return <tbody>{children}</tbody>;
  },
  tr({ children }) {
    return <tr className="border-b border-zinc-200 dark:border-zinc-700">{children}</tr>;
  },
  th({ children }) {
    return <th className="px-2 py-1 text-left font-semibold text-zinc-700 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-700 last:border-r-0">{children}</th>;
  },
  td({ children }) {
    return <td className="px-2 py-1 text-zinc-600 dark:text-zinc-400 border-r border-zinc-200 dark:border-zinc-700 last:border-r-0">{children}</td>;
  },
};

function MarkdownContent({ text }: { text: string }) {
  return (
    <div className="overflow-x-auto text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {preprocessYamlFrontmatter(text)}
      </ReactMarkdown>
    </div>
  );
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, trajectoryRound, isLastInRound }) => {
  const [isThinkingExpanded, setIsThinkingExpanded] = React.useState(false);

  // Debug log
  React.useEffect(() => {
    if (message.type === 'message' && message.message?.role !== 'user') {
      console.log('MessageBubble debug:', {
        role: message.message?.role,
        hasTrajectoryRound: !!trajectoryRound,
        isLastInRound,
        timestamp: message.timestamp
      });
    }
  }, [trajectoryRound, isLastInRound, message]);

  if (message.type === 'session' || message.type === 'model_change' || message.type === 'thinking_level_change' || message.type === 'custom') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xs px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
          {message.type === 'session' && `会话开始: ${new Date(message.timestamp).toLocaleString()}`}
          {message.type === 'model_change' && `模型切换: ${message.modelId} (${message.provider})`}
          {message.type === 'thinking_level_change' && `思考级别: ${message.thinkingLevel}`}
          {message.type === 'custom' && message.customType === 'model-snapshot' && `模型快照: ${message.data.modelId}`}
        </div>
      </div>
    );
  }

  if (message.type !== 'message') return null;

  const { role, content } = message.message;
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  const isTool = role === 'toolResult';
  const toolName = message.message.toolName;

  // 判断是否需要 markdown 渲染：read 工具的输出是 markdown 格式
  const shouldUseMarkdown = (item?: any) => {
    if (isTool && toolName === 'read') return true;
    if (isAssistant && item?.type === 'text') return true;
    return false;
  };

  return (
    <div className={cn("flex w-full mb-3", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%] min-w-0 group", isUser ? "flex-row-reverse ml-auto" : "flex-row mr-auto")}>
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center",
          isUser ? "ml-2 bg-blue-500 text-white" : "mr-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
        )}>
          {isUser ? <User size={16} /> : isAssistant ? <Bot size={16} /> : <Wrench size={16} />}
        </div>

        {/* Content */}
        <div className={cn("flex flex-col min-w-0", isUser ? "items-end" : "items-start")}>
          <div className={cn(
            "px-3 py-2 rounded-2xl shadow-sm border max-w-full",
            isUser 
              ? "bg-white text-zinc-900 border-zinc-200 dark:bg-white dark:text-zinc-900 dark:border-zinc-200 rounded-tr-none shadow-sm" 
              : isTool
                ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-tl-none text-sm"
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-tl-none"
          )}>
            {Array.isArray(content) ? (
              content.map((item: any, idx: number) => (
                <div key={idx} className="mb-1 last:mb-0">
                  {item.type === 'thinking' && (
                    <div className="mb-2 border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 py-1">
                      <button 
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        className="flex items-center text-zinc-500 text-xs font-medium hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                      >
                        <Brain size={14} className="mr-1" />
                        思考过程
                        {isThinkingExpanded ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
                      </button>
                      {isThinkingExpanded && (
                        <div className="mt-2 text-zinc-500 dark:text-zinc-400 text-sm italic prose prose-zinc dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {item.thinking}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                  {item.type === 'text' && shouldUseMarkdown(item) && (
                    <div className="max-w-none">
                      <MarkdownContent text={item.text} />
                    </div>
                  )}
                  {item.type === 'text' && !shouldUseMarkdown(item) && (
                    <CollapsibleText
                      text={item.text}
                      className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 font-mono text-xs"
                    />
                  )}
                  {item.type === 'toolCall' && (
                    <ToolCallBlock item={item} />
                  )}
                </div>
              ))
            ) : (
              <div className={cn(shouldUseMarkdown() ? "max-w-none" : "")}>
                {shouldUseMarkdown() ? (
                  <MarkdownContent text={typeof content === 'string' ? content : JSON.stringify(content, null, 2)} />
                ) : (
                  <CollapsibleText
                    text={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                    className="whitespace-pre-wrap font-mono text-xs text-zinc-700 dark:text-zinc-300"
                  />
                )}
              </div>
            )}
          </div>
          
          {/* Timestamp & Trajectory Info */}
          <div className="flex items-center gap-2 mt-0.5 px-1">
            <span className="text-[10px] text-zinc-400">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {trajectoryRound && !isUser && isLastInRound && (
              <TrajectoryInfo round={trajectoryRound} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
