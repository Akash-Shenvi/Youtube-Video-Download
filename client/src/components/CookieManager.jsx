import { X, CheckCircle2, Lock, Shield, Server, RefreshCw } from 'lucide-react';

export default function CookieManager({ isOpen, onClose, authenticated, checkAuth }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-[#161b2c] border border-white/10 rounded-2xl shadow-2xl max-w-lg w-full animate-slide-up relative">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Authentication Status</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">

                    {/* Status Banner */}
                    <div className={`p-4 rounded-xl border mb-6 ${authenticated
                        ? 'bg-green-500/10 border-green-500/20'
                        : 'bg-slate-800/50 border-white/5'
                        }`}>
                        <div className="flex items-center gap-3">
                            {authenticated ? (
                                <>
                                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                                    <div>
                                        <p className="font-bold text-green-400">System Authenticated</p>
                                        <p className="text-sm text-green-300/70">Using server-side <span className="font-mono bg-green-500/20 px-1 rounded">cookies.txt</span></p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Lock className="w-6 h-6 text-slate-400" />
                                    <div>
                                        <p className="font-bold text-slate-300">Not Connected</p>
                                        <p className="text-sm text-slate-500">Cookie file missing in server directory.</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-[#0f111a] p-5 rounded-xl border border-white/5 space-y-4">
                        <div className="flex items-start gap-3">
                            <Server className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                            <div>
                                <h3 className="text-sm font-semibold text-white mb-1">Manual Configuration</h3>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    Authentication is managed manually on the backend.
                                    To update credentials, replace the file at:
                                </p>
                                <div className="mt-2 bg-black/30 p-2 rounded border border-white/10 relative group">
                                    <code className="text-xs font-mono text-blue-300 break-all">
                                        server/cookies/cookies.txt
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            onClick={checkAuth}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 text-sm font-medium transition-all flex items-center gap-2"
                        >
                            <RefreshCw className="w-3 h-3" />
                            Refresh Status
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/20"
                        >
                            Close
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
