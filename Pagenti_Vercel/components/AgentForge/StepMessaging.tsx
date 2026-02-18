import React, { useState } from 'react';
import { MessageSquare, Send, CheckCircle2, QrCode, Smartphone, MessageCircle, Slack, Mail, Zap, ExternalLink } from 'lucide-react';
import { AgentFormData } from './StepConfigure';
import { CommunicationConfig, CommunicationChannel, MessagingChannelType } from '../../types';

interface StepMessagingProps {
    formData: AgentFormData;
    onChange: (data: Partial<AgentFormData>) => void;
}

export const StepMessaging: React.FC<StepMessagingProps> = ({
    formData,
    onChange
}) => {
    const [connectingChannel, setConnectingChannel] = useState<MessagingChannelType | null>(null);
    const [mockStep, setMockStep] = useState(0);

    const config = formData.communicationConfig || {
        channels: [],
        preferences: {
            urgentOnly: false,
            frequency: 'real-time'
        }
    };

    const isConnected = (type: MessagingChannelType) =>
        config.channels.some(c => c.type === type && c.connected);

    const handleConnect = (type: MessagingChannelType) => {
        setConnectingChannel(type);
        setMockStep(1);

        // Simulate connection flow
        if (type === 'slack') {
            setTimeout(() => {
                const newChannel: CommunicationChannel = {
                    type,
                    handle: '@workspace-pagenti',
                    connected: true,
                    lastActive: new Date().toISOString()
                };
                updateChannels(newChannel);
                setConnectingChannel(null);
            }, 1500);
        }
    };

    const updateChannels = (channel: CommunicationChannel) => {
        const existing = config.channels.filter(c => c.type !== channel.type);
        onChange({
            communicationConfig: {
                ...config,
                channels: [...existing, channel]
            }
        });
    };

    const finishMockConnection = (handle: string) => {
        if (!connectingChannel) return;
        const newChannel: CommunicationChannel = {
            type: connectingChannel,
            handle,
            connected: true,
            lastActive: new Date().toISOString()
        };
        updateChannels(newChannel);
        setConnectingChannel(null);
        setMockStep(0);
    };

    const renderConnectionModal = () => {
        if (!connectingChannel) return null;

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
                <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>

                    <div className="text-center">
                        <h3 className="text-2xl font-black text-gray-900 mb-2 capitalize">
                            Connect {connectingChannel}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium">
                            Follow the steps to link {formData.name}
                        </p>
                    </div>

                    {connectingChannel === 'whatsapp' && (
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-6 rounded-3xl flex items-center justify-center relative group">
                                <QrCode size={200} className="text-gray-900 opacity-20 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/40">
                                        <Zap size={24} className="text-white" />
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-center text-gray-400 font-bold uppercase tracking-widest">
                                Scan with WhatsApp App
                            </p>
                            <button
                                onClick={() => finishMockConnection('+44 7700 900000')}
                                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all"
                            >
                                I've Scanned It
                            </button>
                        </div>
                    )}

                    {connectingChannel === 'telegram' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                                    Enter Bot Token or Handle
                                </label>
                                <input
                                    type="text"
                                    placeholder="@my_agent_bot"
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                />
                            </div>
                            <button
                                onClick={() => finishMockConnection('@pagenti_agent_bot')}
                                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                            >
                                Validate & Link
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => setConnectingChannel(null)}
                        className="w-full text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-900 transition-colors pt-4"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Direct Messaging</h2>
                <p className="text-gray-500 font-medium">
                    Link {formData.name} to your preferred communication channels for real-time, proactive updates.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* WhatsApp */}
                <div className={`p-6 rounded-[2rem] border transition-all flex items-center justify-between ${isConnected('whatsapp') ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isConnected('whatsapp') ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-400'}`}>
                            <MessageCircle size={32} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">WhatsApp</h4>
                            <p className="text-sm text-gray-500">{isConnected('whatsapp') ? 'Directly connected to mobile' : 'Receive instant mobile alerts'}</p>
                        </div>
                    </div>
                    {isConnected('whatsapp') ? (
                        <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                            <CheckCircle2 size={18} /> Linked
                        </div>
                    ) : (
                        <button
                            onClick={() => handleConnect('whatsapp')}
                            className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg"
                        >
                            Connect
                        </button>
                    )}
                </div>

                {/* Telegram */}
                <div className={`p-6 rounded-[2rem] border transition-all flex items-center justify-between ${isConnected('telegram') ? 'bg-sky-50 border-sky-100' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isConnected('telegram') ? 'bg-sky-500 text-white' : 'bg-gray-50 text-gray-400'}`}>
                            <Send size={28} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">Telegram</h4>
                            <p className="text-sm text-gray-500">{isConnected('telegram') ? 'Bot active and monitoring' : 'Secure bot-based communication'}</p>
                        </div>
                    </div>
                    {isConnected('telegram') ? (
                        <div className="flex items-center gap-2 text-sky-600 font-bold text-sm">
                            <CheckCircle2 size={18} /> Linked
                        </div>
                    ) : (
                        <button
                            onClick={() => handleConnect('telegram')}
                            className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg"
                        >
                            Connect
                        </button>
                    )}
                </div>

                {/* Slack */}
                <div className={`p-6 rounded-[2rem] border transition-all flex items-center justify-between ${isConnected('slack') ? 'bg-purple-50 border-purple-100' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isConnected('slack') ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                            <Slack size={28} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900">Slack</h4>
                            <p className="text-sm text-gray-500">{isConnected('slack') ? 'Integrated with Workspace' : 'Broadcast to group channels'}</p>
                        </div>
                    </div>
                    {isConnected('slack') ? (
                        <div className="flex items-center gap-2 text-purple-600 font-bold text-sm">
                            <CheckCircle2 size={18} /> Linked
                        </div>
                    ) : (
                        <button
                            onClick={() => handleConnect('slack')}
                            className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg"
                        >
                            Connect
                        </button>
                    )}
                </div>
            </div>

            {/* Notification Preferences */}
            <div className="bg-white border border-gray-100 rounded-[2.5rem] p-10 mt-10 shadow-sm space-y-8">
                <div className="flex items-center gap-4 pb-6 border-b border-gray-50">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                        <Zap size={24} />
                    </div>
                    <div>
                        <h3 className="font-black text-gray-900">Communication Alpha</h3>
                        <p className="text-sm text-gray-500 font-medium">Configure how {formData.name} interacts with you</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-gray-900">Urgent Mode Only</p>
                            <p className="text-xs text-gray-400 font-medium">Only notify for high-priority executive alerts</p>
                        </div>
                        <button
                            onClick={() => onChange({ communicationConfig: { ...config, preferences: { ...config.preferences, urgentOnly: !config.preferences.urgentOnly } } })}
                            className={`w-14 h-7 rounded-full transition-all relative ${config.preferences.urgentOnly ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${config.preferences.urgentOnly ? 'left-8 shadow-indigo-200' : 'left-1 shadow-gray-200 shadow-sm'}`}></div>
                        </button>
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Update Frequency</p>
                        <div className="grid grid-cols-3 gap-3">
                            {(['real-time', 'daily-summary', 'weekly-digest'] as const).map(freq => (
                                <button
                                    key={freq}
                                    onClick={() => onChange({ communicationConfig: { ...config, preferences: { ...config.preferences, frequency: freq } } })}
                                    className={`py-3 rounded-xl text-xs font-bold uppercase tracking-tight transition-all border ${config.preferences.frequency === freq ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' : 'bg-gray-50 text-gray-500 border-gray-100 hover:border-indigo-200'}`}
                                >
                                    {freq.replace('-', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {renderConnectionModal()}
        </div>
    );
};
