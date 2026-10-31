import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ModelPicker } from './ModelPicker';

export const Composer: React.FC = () => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    currentSessionId,
    sessions,
    activeRuns,
    sendMessage,
    stopCurrentRun
  } = useAppStore();

  const session = sessions.find(s => s.id === currentSessionId);
  const isRunning = currentSessionId ? activeRuns.has(currentSessionId) : false;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 240)}px`;
    }
  }, [text]);

  const handleSend = () => {
    if (isRunning) {
      stopCurrentRun();
      return;
    }

    if (!text.trim() && images.length === 0) return;

    sendMessage(text.trim(), images.length > 0 ? images : undefined);
    setText('');
    setImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setImages(prev => [...prev, reader.result as string]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleModelChange = async (provider: string, model: string) => {
    if (session && window.antrorAPI) {
      session.provider = provider;
      session.model = model;
      session.updatedAt = Date.now();
      await window.antrorAPI.createSession(session);
      useAppStore.getState().loadSessions();
    }
  };

  return (
    <div className="p-4 pt-0 w-full max-w-4xl mx-auto">
      <div className="relative bg-antror-850/90 border border-antror-700/70 rounded-2xl shadow-xl transition-all focus-within:border-brand-500/80 focus-within:ring-1 focus-within:ring-brand-500/40">
        {/* Attached previews */}
        {images.length > 0 && (
          <div className="p-3 pb-0 flex flex-wrap gap-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-antror-700">
                <img src={img} alt="attachment" className="w-16 h-16 object-cover" />
                <button
                  onClick={() => setImages(images.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-0.5 bg-antror-950/80 rounded-full text-white hover:bg-rose-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Reply to Antror or ask anything..."
          rows={1}
          className="w-full bg-transparent px-4 py-3.5 text-sm text-antror-100 placeholder-antror-500 resize-none focus:outline-none min-h-[52px]"
        />

        {/* Bottom Toolbar */}
        <div className="px-3 py-2 border-t border-antror-750/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Model Picker */}
            <ModelPicker
              currentModel={session?.model || 'claude-3-7-sonnet-20250219'}
              currentProvider={session?.provider || 'anthropic'}
              onSelect={handleModelChange}
            />

            {/* Attachment Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-750 rounded-lg transition-colors"
              title="Attach images or documents"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="flex items-center space-x-2">
            {/* Send / Stop button */}
            <button
              onClick={handleSend}
              disabled={!isRunning && !text.trim() && images.length === 0}
              className={`p-2 rounded-xl transition-all ${
                isRunning
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : text.trim() || images.length > 0
                  ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-md'
                  : 'bg-antror-750 text-antror-500 cursor-not-allowed'
              }`}
              title={isRunning ? 'Stop Generation' : 'Send message (Enter)'}
            >
              {isRunning ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="text-center mt-2 text-[11px] text-antror-500">
        Antror Desktop may generate inaccurate info. Always verify critical code.
      </div>
    </div>
  );
};
