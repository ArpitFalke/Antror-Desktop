import React, { useState } from 'react';
import { ChevronDown, Check, Sparkles, Cpu, Search } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface ModelPickerProps {
  currentModel: string;
  currentProvider: string;
  onSelect: (provider: string, model: string) => void;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  currentModel,
  currentProvider,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const providers = useAppStore(state => state.providers);

  const allModels: { providerId: string; providerName: string; modelId: string; modelName: string; thinking?: boolean }[] = [];
  for (const p of providers) {
    if (!p.isEnabled) continue;
    for (const m of p.models) {
      allModels.push({
        providerId: p.id,
        providerName: p.name,
        modelId: m.id,
        modelName: m.name,
        thinking: m.supportsThinking
      });
    }
  }

  const filtered = allModels.filter(m =>
    m.modelName.toLowerCase().includes(search.toLowerCase()) ||
    m.modelId.toLowerCase().includes(search.toLowerCase()) ||
    m.providerName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedModel = allModels.find(m => m.modelId === currentModel) || {
    modelName: currentModel || 'Claude 3.7 Sonnet',
    providerName: currentProvider || 'Anthropic'
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-antror-300 hover:text-antror-100 bg-antror-800/60 hover:bg-antror-700/60 border border-antror-700/60 rounded-full transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5 text-brand-500" />
        <span className="truncate max-w-[160px]">{selectedModel.modelName}</span>
        <ChevronDown className="w-3 h-3 text-antror-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full mb-2 left-0 z-50 w-80 bg-antror-850 border border-antror-700/80 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2 border-b border-antror-700/50 flex items-center space-x-2">
              <Search className="w-3.5 h-3.5 text-antror-400 ml-1" />
              <input
                type="text"
                placeholder="Search models..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs text-antror-200 placeholder-antror-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto p-1 divide-y divide-antror-800/40">
              {filtered.map(item => {
                const isSelected = item.modelId === currentModel;
                return (
                  <button
                    key={`${item.providerId}-${item.modelId}`}
                    onClick={() => {
                      onSelect(item.providerId, item.modelId);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-2 text-left rounded-lg flex items-center justify-between text-xs transition-colors ${
                      isSelected ? 'bg-brand-500/15 text-brand-400' : 'text-antror-300 hover:bg-antror-800/60 hover:text-antror-100'
                    }`}
                  >
                    <div>
                      <div className="font-medium flex items-center space-x-1.5">
                        <span>{item.modelName}</span>
                        {item.thinking && (
                          <span className="px-1.5 py-0.2 bg-brand-500/20 text-brand-400 rounded text-[10px]">
                            Reasoning
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-antror-500 font-mono mt-0.5">
                        {item.providerName} · {item.modelId}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-brand-500 flex-shrink-0" />}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-3 text-center text-xs text-antror-500">
                  No matching models.
                </div>
              )}
            </div>

            {/* Custom Model Input */}
            <div className="p-2 border-t border-antror-700/50 bg-antror-900/50">
              <div className="text-[10px] text-antror-400 mb-1 font-medium">Use Custom Model ID:</div>
              <div className="flex space-x-1">
                <input
                  type="text"
                  placeholder="e.g. gpt-4o-2024-11-20"
                  className="flex-1 bg-antror-950 px-2 py-1 text-xs font-mono text-antror-200 border border-antror-800 rounded focus:outline-none focus:border-brand-500"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        onSelect(currentProvider || 'openai', val);
                        setIsOpen(false);
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
