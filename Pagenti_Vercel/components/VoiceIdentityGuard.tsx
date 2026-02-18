import React, { useState } from 'react';
import { Lock, Unlock, Play, Check, X, ShieldCheck } from 'lucide-react';
import { ttsService } from '../services/ttsService';

interface Props {
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    className?: string;
}

export const VoiceIdentityGuard: React.FC<Props> = ({ value, onChange, placeholder, className }) => {
    const [isEditing, setIsEditing] = useState(!value);
    const [tempId, setTempId] = useState(value);
    const [isTesting, setIsTesting] = useState(false);

    const handleApply = () => {
        onChange(tempId);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setTempId(value);
        setIsEditing(false);
    };

    const handleTest = async () => {
        if (!tempId) return;
        setIsTesting(true);
        try {
            await ttsService.synthesize({
                text: "Voice identity verified. Logic core active.",
                speakerId: tempId
            }).then(url => {
                if (url) {
                    const audio = new Audio(url);
                    audio.play();
                }
            });
        } catch (err) {
            console.error("Test failed", err);
        } finally {
            setIsTesting(false);
        }
    };

    if (!isEditing) {
        return (
            <div className={`flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl transition-all ${className}`}>
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <ShieldCheck size={16} />
                </div>
                <div className="flex-1 overflow-hidden">
                    <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest leading-none mb-1">Authenticated ID</div>
                    <div className="text-xs font-mono text-emerald-900 truncate">{value || 'No ID Configured'}</div>
                </div>
                <button
                    onClick={() => setIsEditing(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 underline"
                >
                    Change
                </button>
            </div>
        );
    }

    return (
        <div className={`space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-200 ${className}`}>
            <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Unlock size={10} className="text-amber-500" /> Configure Voice ID
                </label>
            </div>

            <div className="relative">
                <input
                    value={tempId}
                    onChange={(e) => setTempId(e.target.value)}
                    placeholder={placeholder || "Paste ElevenLabs ID"}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all pr-10"
                />
                {tempId && (
                    <button
                        onClick={handleTest}
                        disabled={isTesting}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${isTesting ? 'bg-indigo-100 text-indigo-400' : 'text-indigo-600 hover:bg-indigo-50'
                            }`}
                        title="Test Voice"
                    >
                        {isTesting ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : <Play size={14} fill="currentColor" />}
                    </button>
                )}
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleApply}
                    disabled={!tempId}
                    className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                    <Check size={12} /> Confirm & Lock
                </button>
                {value && (
                    <button
                        onClick={handleCancel}
                        className="px-4 bg-white border border-gray-200 text-gray-500 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};
