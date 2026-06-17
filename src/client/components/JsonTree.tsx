import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function JsonTree({ data, depth = 0 }: { data: any; depth?: number }) {
  const [expanded, setExpanded] = React.useState(false);

  if (data === null) return <span className="text-red-500 text-xs">null</span>;
  if (data === undefined) return <span className="text-zinc-400 text-xs">undefined</span>;

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === 'object' && parsed !== null) {
        return <JsonTree data={parsed} depth={depth} />;
      }
    } catch {}
    return <span className="text-green-600 dark:text-green-400 text-xs">"{data}"</span>;
  }

  if (typeof data === 'number') return <span className="text-blue-600 dark:text-blue-400 text-xs">{data}</span>;
  if (typeof data === 'boolean') return <span className="text-purple-600 dark:text-purple-400 text-xs">{String(data)}</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-zinc-400">[]</span>;
    const isSimple = data.length <= 5 && data.every(v => typeof v !== 'object' || v === null);
    if (isSimple) {
      const items = data.map((v, i) => <JsonTree key={i} data={v} depth={depth} />);
      const joined = items.reduce((acc, el) => <>{acc}, {el}</>);
      return <span className="text-zinc-600 dark:text-zinc-300 text-xs">[{joined}]</span>;
    }
    return (
      <div>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="font-mono">Array({data.length})</span>
        </button>
        {expanded && (
          <div className="border-l-2 border-zinc-200 dark:border-zinc-700 ml-1 pl-3 mt-1 space-y-0.5">
            {data.map((v, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-zinc-400 font-mono text-xs shrink-0 w-4">{i}:</span>
                <JsonTree data={v} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return <span className="text-zinc-400">{'{}'}</span>;
    return (
      <div>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span className="font-mono">{'{...}'} ({keys.length} keys)</span>
        </button>
        {expanded && (
          <div className="border-l-2 border-zinc-200 dark:border-zinc-700 ml-1 pl-3 mt-1 space-y-0.5">
            {keys.map(key => (
              <div key={key} className="flex gap-2">
                <span className="text-red-600 dark:text-red-400 font-mono text-xs shrink-0">"{key}":</span>
                <JsonTree data={data[key]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span>{String(data)}</span>;
}
