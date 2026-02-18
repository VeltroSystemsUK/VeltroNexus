import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DigitalAssociate } from '../types';
import { useI18n } from '../I18nContext';
import { Mic, Send, Volume2, Square, Terminal as TerminalIcon, ShieldCheck, ExternalLink } from 'lucide-react';
import { interactWithAgent, generateBackgroundActivity } from '../services/geminiService';
import { chatService, ChatMessage } from '../services/chatService';
import { ttsService } from '../services/ttsService';
import { useToast } from '../contexts/ToastContext';

interface Props {
  candidate: DigitalAssociate;
  colorClass: string;
  hidePopOut?: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

export const LiveTerminal: React.FC<Props> = ({ candidate, colorClass, hidePopOut = false }) => {
  const { tl } = useI18n();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activityLogs, setActivityLogs] = useState<string[]>([]);
  const [useTTS, setUseTTS] = useState(false); // Cloud/ElevenLabs TTS availability
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Runtime
  useEffect(() => {
    // Check specialized TTS availability
    ttsService.isAvailable().then(available => {
      setUseTTS(available);
      if (available) {
        console.log('[Voice] ElevenLabs/Cloud TTS available');
      } else {
        console.log('[Voice] Using browser speech synthesis fallback');
      }
    });

    // Load History
    const history = chatService.getHistory(candidate.id);
    if (history.length > 0) {
      setMessages(history);
    } else {
      // Initial Greeting only if no history
      setTimeout(() => {
        const hour = new Date().getHours();
        let greeting = 'Good Morning';
        if (hour >= 12) greeting = 'Good Afternoon';
        if (hour >= 17) greeting = 'Good Evening';

        const greetingMsg = `${greeting} Shaun, what would you like me to do for you today?`;
        addMessage('agent', greetingMsg);
      }, 1000);
    }

    const logs = generateBackgroundActivity(typeof candidate.role === 'string' ? candidate.role : candidate.role.en);
    setActivityLogs(logs);

    // Ensure browser voices are loaded as fallback
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }, [candidate.id]);

  const addMessage = (sender: 'user' | 'agent', text: string) => {
    const newMessage: ChatMessage = { id: crypto.randomUUID(), sender, text, timestamp: new Date() };
    setMessages(prev => [...prev, newMessage]);
    chatService.saveMessage(candidate.id, newMessage);
    if (sender === 'agent') speak(text);
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userText = input;
    setInput('');
    addMessage('user', userText);
    setIsProcessing(true);

    try {
      const response = await interactWithAgent(userText, {
        id: candidate.id,
        name: candidate.name,
        role: typeof candidate.role === 'string' ? candidate.role : candidate.role.en,
        department: candidate.department,
        hourlyRate: candidate.hourlyRate,
        tools: candidate.tools,
        caseStudy: candidate.caseStudy,
        description: typeof candidate.description === 'string' ? candidate.description : candidate.description.en,
        activityLogs,
        knowledgeBase: candidate.knowledgeBase
      });
      addMessage('agent', response.response);

      if (response.action) {
        console.log("Agent Action Triggered:", response.action);

        // Map actions to friendly messages
        const actionMessages: Record<string, string> = {
          'NAVIGATE_DASHBOARD': 'Opening Project Dashboard...',
          'NAVIGATE_FORGE': 'Redirecting to Agent Forge...',
          'DEPLOY_ME': 'Initiating Deployment Protocol...',
          'HIRE_ME': 'Preparing Consultation...'
        };

        const msg = actionMessages[response.action] || 'Executing System Command...';
        showToast(msg, 'info');

        setTimeout(() => {
          switch (response.action) {
            case 'NAVIGATE_DASHBOARD':
              navigate('/dashboard');
              break;
            case 'NAVIGATE_FORGE':
              navigate('/forge');
              break;
            case 'DEPLOY_ME':
              navigate(`/deploy/${candidate.id}`);
              break;
            case 'HIRE_ME':
              // In a real app, this would pre-fill the hiring form with candidate.id
              navigate('/consultation');
              break;
          }
        }, 1500); // Small delay so user can read the message first
      }

    } catch (e) {
      addMessage('agent', 'Error: Link unstable.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Voice Logic - ElevenLabs TTS with Browser Fallback
  const speak = async (text: string) => {
    setIsSpeaking(true);

    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const voiceId = candidate.voiceId || '';

    // Try ElevenLabs TTS API first
    if (useTTS && voiceId) {
      try {
        const speakerId = ttsService.mapVoiceId(voiceId);
        console.log('[Voice] Using ElevenLabs TTS with speaker:', speakerId);

        const audioUrl = await ttsService.synthesize({
          text,
          speakerId,
          speed: 1.0
        });

        if (audioUrl) {
          const audio = new Audio(audioUrl);
          currentAudioRef.current = audio;

          audio.onended = () => {
            setIsSpeaking(false);
            currentAudioRef.current = null;
          };
          console.warn('[Voice] Audio failed. No fallback active.');
          setIsSpeaking(false);

          try {
            await audio.play();
          } catch (playError) {
            console.error('[Voice] Playback failed:', playError);
            setIsSpeaking(false);
          }
          return;
        }
      } catch (error) {
        console.warn('[Voice] ElevenLabs TTS failed, no fallback active:', error);
        setIsSpeaking(false);
      }
    }
  };

  // Browser Speech Synthesis disabled as per user request

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }

    if (isListening) {
      // Stop logic handled by end event usually, but we can force stop
      setIsListening(false);
      return;
    }

    const Recognition = (window as any).webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      // Auto-send if high confidence? Let's just fill input for now
    };

    recognition.start();
  };

  const handlePopOut = () => {
    const url = `#/uplink/${candidate.id}`;
    const width = 450;
    const height = 700;
    const left = window.screen.width - width - 100;
    const top = 100;

    window.open(
      url,
      `uplink_${candidate.id}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
    );
    showToast('Secure Uplink Pooled. Externalizing terminal...', 'info');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] font-sans h-full flex flex-col border border-white/20 shadow-2xl relative overflow-hidden group ring-1 ring-gray-900/5">
      {/* Modern Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-white/50">
        <div className="flex items-center gap-4">
          <div className="relative">
            {/* Speaking Animation Rings */}
            {isSpeaking && (
              <>
                <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                <div className="absolute -inset-1 bg-indigo-400 rounded-full animate-pulse opacity-30"></div>
                <div className="absolute -inset-2 bg-indigo-300 rounded-full animate-pulse opacity-10 [animation-duration:1.5s]"></div>
              </>
            )}

            <img
              src={candidate.avatar}
              alt={candidate.name}
              className={`w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm transition-transform duration-300 ${isSpeaking ? 'scale-105 ring-indigo-200' : ''}`}
            />

            {/* Status Dot */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors ${isSpeaking ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></div>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 leading-tight text-base">{candidate.name}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`font-bold transition-colors ${isSpeaking ? 'text-indigo-600' : 'text-gray-600'}`}>
                {isSpeaking ? 'Speaking...' : (typeof candidate.role === 'string' ? candidate.role : candidate.role.en)}
              </span>
              {isSpeaking && (
                <span className="flex gap-0.5 items-end h-3 pb-0.5">
                  <span className="w-0.5 h-2 bg-indigo-600 animate-[bounce_1s_infinite]"></span>
                  <span className="w-0.5 h-3 bg-indigo-600 animate-[bounce_1.2s_infinite]"></span>
                  <span className="w-0.5 h-1.5 bg-indigo-600 animate-[bounce_0.8s_infinite]"></span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isProcessing && (
            <div className="flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-full text-amber-600 text-xs font-bold border border-amber-100">
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-delay:0.1s]"></div>
              <span className="ml-1">Processing</span>
            </div>
          )}
          <div className="bg-gray-50 text-gray-400 p-2.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
            <Volume2 size={18} />
          </div>
          {!hidePopOut && (
            <button
              onClick={handlePopOut}
              className="bg-indigo-50 text-indigo-600 p-2.5 rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100"
              title="Pop out into dedicated window"
            >
              <ExternalLink size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {/* Welcome / Context Bubble */}
        <div className="flex justify-center pb-4">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl padding-3 shadow-sm max-w-sm text-center py-3 px-6">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Encrypted Connection</span>
            </div>
          </div>
        </div>

        {activityLogs.length > 0 && messages.length === 0 && (
          <div className="flex justify-center">
            <div className="text-xs text-gray-400 bg-gray-100 px-4 py-2 rounded-full">
              {activityLogs[0]}...
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'} gap-3 items-end`}>

              {/* Avatar for Agent Message */}
              {msg.sender === 'agent' && (
                <div className={`relative flex-shrink-0 ${isSpeaking && msg.timestamp.getTime() > Date.now() - 5000 ? 'animate-bounce' : ''}`}>
                  <img src={candidate.avatar} className="w-8 h-8 rounded-full shadow-sm ring-2 ring-white" />
                </div>
              )}

              <div className={`p-4 shadow-sm text-[13px] leading-relaxed relative group ${msg.sender === 'user'
                ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                : 'bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-tl-sm'
                }`}>
                {msg.text}
                <div className={`text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-5 w-full ${msg.sender === 'user' ? 'text-right right-0 text-gray-400' : 'text-left left-0 text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.3s]"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex gap-3 items-center bg-gray-50 p-2 rounded-[1.5rem] border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all shadow-inner group-focus-within:bg-white">
          <button
            onClick={toggleListening}
            className={`p-3 rounded-full transition-all ${isListening
              ? 'bg-red-500 text-white animate-pulse shadow-md ring-4 ring-red-100'
              : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
          >
            {isListening ? <Square size={18} /> : <Mic size={18} />}
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Type a message to ${candidate.name}...`}
            className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-400 text-sm font-medium h-10"
          />

          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`p-3 rounded-full transition-all shadow-sm ${input.trim()
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-110 hover:shadow-md'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
