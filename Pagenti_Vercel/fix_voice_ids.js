// Utility to fix voice IDs in localStorage
// Run this in the browser console to reset all agents to use proper voice IDs

console.log('[Voice Fix] Starting voice ID cleanup...');

// Get all agents from localStorage
const agentsKey = 'pag enti_agents';
const storedAgents = localStorage.getItem(agentsKey);

if (storedAgents) {
    const agents = JSON.parse(storedAgents);
    console.log('[Voice Fix] Found', agents.length, 'agents in localStorage');

    // Map of invalid voice names to proper IDs
    const voiceNameToId = {
        'Alice - Clear, Engaging Educator (female)': null, // Will use browser default
        'Clarice - Natural & Calm British Voice (female)': null,
        // Add more mappings as needed
    };

    let fixed = 0;
    agents.forEach(agent => {
        const oldVoiceId = agent.voiceId;

        // If voiceId contains a dash and spaces, it's likely a name instead of an ID
        if (oldVoiceId && oldVoiceId.includes(' - ')) {
            console.log(`[Voice Fix] Fixing ${agent.name}: "${oldVoiceId}" -> browser default`);
            agent.voiceId = ''; // Reset to browser default
            fixed++;
        }
    });

    if (fixed > 0) {
        localStorage.setItem(agentsKey, JSON.stringify(agents));
        console.log(`[Voice Fix] ✅ Fixed ${fixed} agents. Please refresh the page.`);
    } else {
        console.log('[Voice Fix] No agents needed fixing.');
    }
} else {
    console.log('[Voice Fix] No agents found in localStorage.');
}
