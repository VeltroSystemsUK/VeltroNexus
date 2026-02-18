/**
 * ElevenLabs Cloud TTS Service
 * Frontend client for the ElevenLabs Text-to-Speech API
 * 
 * Provides high-quality voice synthesis using ElevenLabs
 * with zero-shot voice cloning capabilities.
 */

const TTS_API_BASE = import.meta.env.VITE_TTS_API_URL || 'http://localhost:8000';

export interface Voice {
    id: string;
    name: string;
    language: string;
    is_cloned: boolean;
    description?: string;
}

export interface TTSHealthStatus {
    status: string;
    gpu_available: boolean;
    gpu_name: string | null;
    openvoice_available: boolean;
    device: string;
    voices_count: number;
}

export interface GenerateOptions {
    text: string;
    speakerId: string;
    speed?: number;
}

// ElevenLabs Configuration
const ELEVEN_API_KEY = (import.meta.env.VITE_ELEVENLABS_API_KEY || "").trim();
const ELEVEN_API_URL = "https://api.elevenlabs.io/v1";

const ELEVEN_VOICE_MAP: Record<string, string> = {
    'default': ''
};

class TTSService {
    private baseUrl: string;
    private audioCache: Map<string, string> = new Map();
    private useCloud: boolean = false;

    constructor() {
        this.baseUrl = TTS_API_BASE;

        // Prioritize ElevenLabs if API key is present
        if (ELEVEN_API_KEY) {
            this.useCloud = true;
            console.log("🚀 TTS: ElevenLabs Activated (Cloud Mode)");
        } else if (import.meta.env.PROD || !this.baseUrl.includes('localhost')) {
            // Fallback for production or remote APIs without key (unlikely but safe)
            this.useCloud = false;
            console.log("📡 TTS: Running in Local/Remote Mode (No ElevenLabs Key)");
        }
    }

    /**
     * Check if the TTS API is available and healthy
     */
    async checkHealth(): Promise<TTSHealthStatus | null> {
        if (this.useCloud && ELEVEN_API_KEY) {
            return {
                status: 'healthy',
                gpu_available: true,
                gpu_name: 'ElevenLabs Cloud',
                openvoice_available: true,
                device: 'cloud',
                voices_count: 50
            };
        }

        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
            const fetchPromise = fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

            if (!response.ok) {
                console.warn('[TTS] Local Health check failed, trying fallback...');
                return null;
            }

            return await response.json();
        } catch (error) {
            console.warn('[TTS] Local API not available, switching to Cloud if enabled:', error);
            if (ELEVEN_API_KEY) {
                this.useCloud = true;
                return this.checkHealth(); // Retry with cloud
            }
            return null;
        }
    }

    /**
     * Check if the TTS service is configured and available
     */
    async isAvailable(): Promise<boolean> {
        const health = await this.checkHealth();
        return health?.status === 'healthy';
    }

    /**
     * Get all available voices
     */
    async getVoices(): Promise<Voice[]> {
        if (this.useCloud) {
            return [
                { id: 'british-male', name: 'James (British)', language: 'en-GB', is_cloned: false },
                { id: 'british-female', name: 'Alice (British)', language: 'en-GB', is_cloned: false },
                { id: 'american-male', name: 'John (American)', language: 'en-US', is_cloned: false },
                { id: 'american-female', name: 'Sarah (American)', language: 'en-US', is_cloned: false },
            ];
        }

        try {
            const response = await fetch(`${this.baseUrl}/voices`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                console.error('[TTS] Failed to fetch voices:', response.status);
                return [];
            }

            return await response.json();
        } catch (error) {
            console.error('[TTS] Error fetching voices:', error);
            return [];
        }
    }

    /**
     * Generate audio from text
     * Returns a blob URL that can be used with an Audio element
     */
    async synthesize(options: GenerateOptions): Promise<string | null> {
        const { text, speakerId, speed = 1.0 } = options;

        if (!speakerId) {
            console.warn('[TTS] Synthesis skipped: No speakerId provided.');
            return null;
        }

        // Generate cache key
        const cacheKey = `${speakerId}:${speed}:${text.substring(0, 50)}`;

        // Check cache for short texts
        if (text.length < 200 && this.audioCache.has(cacheKey)) {
            console.log('[TTS] Using cached audio');
            return this.audioCache.get(cacheKey)!;
        }

        try {
            const mode = this.useCloud ? 'ElevenLabs' : 'Local (OpenVoice)';
            console.log(`[TTS] Generating audio via ${mode}...`, { speakerId, textLength: text.length });

            let response: Response;

            if (this.useCloud) {
                // ElevenLabs Logic
                const elevenId = this.mapVoiceId(speakerId);
                console.log(`[TTS] Requesting ElevenLabs Voice ID: ${elevenId}`);
                response = await fetch(`${ELEVEN_API_URL}/text-to-speech/${elevenId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'xi-api-key': ELEVEN_API_KEY || ''
                    },
                    body: JSON.stringify({
                        text,
                        model_id: "eleven_multilingual_v2",
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75
                        }
                    })
                });
            } else {
                // OpenVoice Local Logic
                response = await fetch(`${this.baseUrl}/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'audio/wav'
                    },
                    body: JSON.stringify({
                        text,
                        speaker_id: speakerId,
                        speed
                    })
                });
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                console.error('[TTS] Generation failed:', error);

                // Fallback Logic: If Local Failed, try Cloud
                if (!this.useCloud && ELEVEN_API_KEY) {
                    console.log("⚠️ Local TTS failed, failing over to Cloud...");
                    this.useCloud = true;
                    return this.synthesize(options);
                }
                return null;
            }

            // Get audio blob and create URL
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            // Cache short texts
            if (text.length < 200) {
                this.audioCache.set(cacheKey, audioUrl);
            }

            console.log('[TTS] Audio generated successfully');
            return audioUrl;

        } catch (error) {
            console.error('[TTS] Synthesis error:', error);
            // Fallback Logic
            if (!this.useCloud && ELEVEN_API_KEY) {
                this.useCloud = true;
                return this.synthesize(options);
            }
            return null;
        }
    }

    // ... keep rest ...

    /**
     * Play audio directly using the API
     */
    async speak(text: string, speakerId: string, speed: number = 1.0): Promise<HTMLAudioElement | null> {
        const audioUrl = await this.synthesize({ text, speakerId, speed });

        if (!audioUrl) {
            return null;
        }

        const audio = new Audio(audioUrl);

        return new Promise((resolve, reject) => {
            audio.oncanplaythrough = () => {
                audio.play()
                    .then(() => resolve(audio))
                    .catch(reject);
            };
            audio.onerror = () => reject(new Error('Failed to load audio'));
        });
    }

    /**
     * Clone a new voice from an audio sample
     */
    async cloneVoice(name: string, audioFile: File, description?: string): Promise<Voice | null> {
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('sample', audioFile);
            if (description) {
                formData.append('description', description);
            }

            console.log('[TTS] Cloning voice...', { name, fileName: audioFile.name });

            const response = await fetch(`${this.baseUrl}/add-voice`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                console.error('[TTS] Voice cloning failed:', error);
                return null;
            }

            const result = await response.json();
            console.log('[TTS] Voice cloned successfully:', result.voice_id);

            return {
                id: result.voice_id,
                name: result.name,
                language: 'EN',
                is_cloned: true,
                description: description
            };

        } catch (error) {
            console.error('[TTS] Voice cloning error:', error);
            return null;
        }
    }

    /**
     * Delete a cloned voice
     */
    async deleteVoice(voiceId: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                console.error('[TTS] Failed to delete voice:', response.status);
                return false;
            }

            console.log('[TTS] Voice deleted:', voiceId);
            return true;

        } catch (error) {
            console.error('[TTS] Delete voice error:', error);
            return false;
        }
    }

    /**
     * Clear the audio cache
     */
    clearCache(): void {
        // Revoke all cached blob URLs to free memory
        this.audioCache.forEach(url => URL.revokeObjectURL(url));
        this.audioCache.clear();
        console.log('[TTS] Cache cleared');
    }

    /**
     * Map voice ID to ElevenLabs or VoxForge speaker ID
     * Handles hardcoded keys, legacy IDs, and direct ElevenLabs IDs
     */
    mapVoiceId(voiceId: string): string {
        if (!voiceId) return '';

        // If it's a direct ElevenLabs ID (typically 20 alphanumeric chars)
        // Check if it's not one of our hardcoded keys and looks like a real ID
        if (voiceId.length >= 18 && /^[a-zA-Z0-9]+$/.test(voiceId)) {
            return voiceId;
        }

        // Check our internal mapping
        const internalId = ELEVEN_VOICE_MAP[voiceId];
        if (internalId) return internalId;

        // Legacy browser ID mapping
        const mapping: Record<string, string> = {
            'en-GB-female': 'british-female',
            'en-GB-male': 'british-male',
            'en-US-female': 'american-female',
            'en-US-male': 'american-male',
        };

        const mappedKey = mapping[voiceId];
        if (mappedKey && ELEVEN_VOICE_MAP[mappedKey]) {
            return ELEVEN_VOICE_MAP[mappedKey];
        }

        return '';
    }
}

// Export singleton instance
export const ttsService = new TTSService();
