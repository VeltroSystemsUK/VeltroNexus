export interface ChatMessage {
    id: string;
    sender: 'user' | 'agent';
    text: string;
    timestamp: Date;
}

const CHAT_STORAGE_KEY = 'pagenti_chat_history';

export const chatService = {
    getHistory: (agentId: string): ChatMessage[] => {
        try {
            const allData = localStorage.getItem(CHAT_STORAGE_KEY);
            const parsed = allData ? JSON.parse(allData) : {};
            const messages = parsed[agentId] || [];
            return messages.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp)
            }));
        } catch (e) {
            console.error("Failed to load chat history", e);
            return [];
        }
    },

    saveMessage: (agentId: string, message: ChatMessage) => {
        try {
            const allData = localStorage.getItem(CHAT_STORAGE_KEY);
            const parsed = allData ? JSON.parse(allData) : {};

            if (!parsed[agentId]) parsed[agentId] = [];

            // Limit history to last 50 messages to prevent storage overflow
            const history = [...parsed[agentId], message];
            if (history.length > 50) history.shift();

            parsed[agentId] = history;
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(parsed));
        } catch (e) {
            console.error("Failed to save chat message", e);
        }
    },

    clearHistory: (agentId: string) => {
        const allData = localStorage.getItem(CHAT_STORAGE_KEY);
        if (allData) {
            const parsed = JSON.parse(allData);
            delete parsed[agentId];
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(parsed));
        }
    }
};
