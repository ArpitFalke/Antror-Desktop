import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const BrowserPanel: React.FC = () => {
  const [url, setUrl] = useState('https://duckduckgo.com');
  const [currentDisplayUrl, setCurrentDisplayUrl] = useState('https://duckduckgo.com');
  const sendMessage = useAppStore(state => state.sendMessage);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    setCurrentDisplayUrl(target);
    if (window.antrorAPI) {
      window.antrorAPI.browserNavigate(target);
    }
  };

  const handleAskAboutPage = async () => {
    if (!window.antrorAPI) return;
    try {
      const snap = await window.antrorAPI.getBrowserSnapshot();
      const prompt = `Please review this web page (${snap.url}):\n\n**Title**: ${snap.title}\n\n**Content Snapshot**:\n${snap.text.slice(0, 10000)}\n\nWhat are the main key takeaways?`;
      sendMessage(prompt);
    } catch (e: any) {
      alert(`Could not extract page text: ${e.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-antror-950 border-l border-antror-800/80">
      {/* Browser Bar */}
      <div className="h-12 border-b border-antror-800/80 px-3 bg-antror-900 flex items-center space-x-2 flex-shrink-0">
        <button
          onClick={() => window.antrorAPI?.browserGoBack()}
          className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-800 rounded-lg transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => window.antrorAPI?.browserGoForward()}
          className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-800 rounded-lg transition-colors"
          title="Forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => window.antrorAPI?.browserReload()}
          className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-800 rounded-lg transition-colors"
          title="Reload"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        {/* Address input */}
        <form onSubmit={handleNavigate} className="flex-1 min-w-0">
          <div className="relative flex items-center">
            <Globe className="w-3.5 h-3.5 text-antror-500 absolute left-2.5" />
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Enter URL or search query..."
              className="w-full bg-antror-950 border border-antror-800 rounded-lg pl-8 pr-3 py-1 text-xs text-antror-200 focus:outline-none focus:border-brand-500/80"
            />
          </div>
        </form>

        {/* Ask about page button */}
        <button
          onClick={handleAskAboutPage}
          className="flex items-center space-x-1.5 px-2.5 py-1 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-lg text-xs font-medium transition-colors"
          title="Summarize and chat about this page"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-500" />
          <span className="hidden sm:inline">Ask about page</span>
        </button>
      </div>

      {/* Browser Viewport */}
      <div className="flex-1 w-full bg-antror-950 overflow-hidden relative">
        <iframe
          src={currentDisplayUrl}
          className="w-full h-full border-none"
          title="Antror Browser"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
};
