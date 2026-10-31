import React from 'react';
import { ShieldAlert, Check, X, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const PermissionModal: React.FC = () => {
  const { pendingPermission, respondPermission } = useAppStore();

  if (!pendingPermission) return null;

  const { toolName, params, riskLevel } = pendingPermission;

  const getRiskBadge = () => {
    switch (riskLevel) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600/30 text-rose-400 border border-rose-500/40">CRITICAL RISK</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600/30 text-amber-400 border border-amber-500/40">HIGH RISK</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-600/30 text-yellow-400 border border-yellow-500/40">MODERATE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600/30 text-emerald-400 border border-emerald-500/40">SAFE</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-antror-850 border border-antror-700 rounded-2xl shadow-2xl overflow-hidden p-6 text-left">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-antror-100">Tool Execution Approval</h3>
              <p className="text-xs text-antror-400">The assistant is requesting permission to run an external tool.</p>
            </div>
          </div>
          {getRiskBadge()}
        </div>

        <div className="mb-4 space-y-2">
          <div className="text-xs font-mono font-medium text-antror-200 bg-antror-900 px-3 py-1.5 rounded-lg border border-antror-800">
            Tool: <span className="text-brand-400">{toolName}</span>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-antror-500 uppercase tracking-wider mb-1">Parameters</div>
            <pre className="p-3 bg-antror-950 rounded-lg border border-antror-800 font-mono text-xs text-antror-300 max-h-48 overflow-y-auto">
              {JSON.stringify(params, null, 2)}
            </pre>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-antror-750">
          <button
            onClick={() => respondPermission('deny')}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-antror-300 hover:text-antror-100 hover:bg-antror-800 rounded-xl transition-colors"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span>Deny</span>
          </button>

          <button
            onClick={() => respondPermission('allow_always_project')}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-antror-300 hover:text-antror-100 bg-antror-800 hover:bg-antror-750 rounded-xl transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            <span>Always for Project</span>
          </button>

          <button
            onClick={() => respondPermission('allow_once')}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-md transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Allow Once</span>
          </button>
        </div>
      </div>
    </div>
  );
};
