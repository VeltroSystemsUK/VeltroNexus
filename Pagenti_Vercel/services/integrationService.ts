export interface IntegrationProvider {
    id: string;
    name: string;
    description: string;
    category: 'Communication' | 'CRM' | 'Development' | 'Marketing' | 'Productivity';
    iconName: string; // Storing string name to map to lucide icons in UI
    color: string;
    bg: string;
    isCustom?: boolean;
}

export interface IntegrationConfig {
    id: string;
    agentId: string;
    providerId: string; // Changed from provider enum to string ID
    status: 'connected' | 'disconnected';
    permissions: 'read' | 'read_write';
    username?: string;
    password?: string;
    lastSync?: string;
}

export interface DeploymentStatus {
    agentId: string;
    status: 'draft' | 'deploying' | 'active' | 'paused';
    deployedAt?: string;
    environment: 'staging' | 'production';
}

const INTEGRATION_KEY = 'pagenti_integrations';
const DEPLOYMENT_KEY = 'pagenti_deployments';
const CUSTOM_PROVIDERS_KEY = 'pagenti_custom_providers';

export const DEFAULT_PROVIDERS: IntegrationProvider[] = [
    // Communication
    { id: 'google', name: 'Google Workspace', description: 'Gmail, Calendar, Drive', category: 'Communication', iconName: 'Mail', color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'microsoft', name: 'Microsoft 365', description: 'Outlook, Teams, SharePoint', category: 'Communication', iconName: 'AppWindow', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'slack', name: 'Slack', description: 'Internal Comms, Alerts', category: 'Communication', iconName: 'MessageSquare', color: 'text-purple-500', bg: 'bg-purple-500/10' },

    // CRM
    { id: 'hubspot', name: 'HubSpot', description: 'CRM, Marketing, Sales', category: 'CRM', iconName: 'Database', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'salesforce', name: 'Salesforce', description: 'Enterprise CRM Cloud', category: 'CRM', iconName: 'Cloud', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'pipedrive', name: 'Pipedrive', description: 'Sales CRM & Pipeline', category: 'CRM', iconName: 'DollarSign', color: 'text-green-500', bg: 'bg-green-500/10' },

    // Development
    { id: 'github', name: 'GitHub', description: 'Source Code, PRs, Issues', category: 'Development', iconName: 'Github', color: 'text-white', bg: 'bg-white/10' },
    { id: 'jira', name: 'Jira Software', description: 'Project Tracking', category: 'Development', iconName: 'Trello', color: 'text-blue-600', bg: 'bg-blue-600/10' },
    { id: 'aws', name: 'AWS Console', description: 'Cloud Infrastructure', category: 'Development', iconName: 'Server', color: 'text-amber-500', bg: 'bg-amber-500/10' },

    // Marketing & Social
    { id: 'linkedin', name: 'LinkedIn', description: 'Professional Network', category: 'Marketing', iconName: 'Linkedin', color: 'text-blue-700', bg: 'bg-blue-700/10' },
    { id: 'twitter', name: 'X / Twitter', description: 'Social Media Posts', category: 'Marketing', iconName: 'Twitter', color: 'text-white', bg: 'bg-gray-800/50' },
    { id: 'mailchimp', name: 'Mailchimp', description: 'Email Marketing', category: 'Marketing', iconName: 'Mail', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
];

export const integrationService = {
    getAllProviders: (): IntegrationProvider[] => {
        const customData = localStorage.getItem(CUSTOM_PROVIDERS_KEY);
        const custom: IntegrationProvider[] = customData ? JSON.parse(customData) : [];
        return [...DEFAULT_PROVIDERS, ...custom];
    },

    addCustomProvider: (name: string, category: IntegrationProvider['category']) => {
        const customData = localStorage.getItem(CUSTOM_PROVIDERS_KEY);
        const custom: IntegrationProvider[] = customData ? JSON.parse(customData) : [];

        const newProvider: IntegrationProvider = {
            id: `custom_${Date.now()}`,
            name,
            description: 'Custom Integration',
            category,
            iconName: 'Globe', // Default icon
            color: 'text-indigo-400',
            bg: 'bg-indigo-400/10',
            isCustom: true
        };

        custom.push(newProvider);
        localStorage.setItem(CUSTOM_PROVIDERS_KEY, JSON.stringify(custom));
        return newProvider;
    },

    getIntegrations: (agentId: string): IntegrationConfig[] => {
        const data = localStorage.getItem(INTEGRATION_KEY);
        const all: IntegrationConfig[] = data ? JSON.parse(data) : [];
        return all.filter(i => i.agentId === agentId);
    },

    toggleIntegration: (agentId: string, providerId: string, credentials?: { username?: string, password?: string }) => {
        const data = localStorage.getItem(INTEGRATION_KEY);
        let all: IntegrationConfig[] = data ? JSON.parse(data) : [];

        const existingIndex = all.findIndex(i => i.agentId === agentId && i.providerId === providerId);

        if (existingIndex >= 0) {
            // Update or Toggle
            if (credentials) {
                // If credentials provided, just update them and ensure connected
                all[existingIndex].username = credentials.username;
                all[existingIndex].password = credentials.password;
                all[existingIndex].status = 'connected';
            } else {
                // If no credentials, just toggle status (disconnect)
                all[existingIndex].status = all[existingIndex].status === 'connected' ? 'disconnected' : 'connected';
            }
            all[existingIndex].lastSync = new Date().toISOString();
        } else {
            // Add new
            all.push({
                id: crypto.randomUUID(),
                agentId,
                providerId,
                status: 'connected',
                permissions: 'read',
                username: credentials?.username,
                password: credentials?.password,
                lastSync: new Date().toISOString()
            });
        }

        localStorage.setItem(INTEGRATION_KEY, JSON.stringify(all));
        return all.filter(i => i.agentId === agentId);
    },

    getDeploymentStatus: (agentId: string): DeploymentStatus => {
        const data = localStorage.getItem(DEPLOYMENT_KEY);
        const all: DeploymentStatus[] = data ? JSON.parse(data) : [];
        return all.find(d => d.agentId === agentId) || { agentId, status: 'draft', environment: 'staging' };
    },

    deployAgent: (agentId: string) => {
        const data = localStorage.getItem(DEPLOYMENT_KEY);
        let all: DeploymentStatus[] = data ? JSON.parse(data) : [];

        const existingIndex = all.findIndex(d => d.agentId === agentId);
        if (existingIndex >= 0) {
            all[existingIndex].status = 'active';
            all[existingIndex].deployedAt = new Date().toISOString();
            all[existingIndex].environment = 'production';
        } else {
            all.push({
                agentId,
                status: 'active',
                deployedAt: new Date().toISOString(),
                environment: 'production'
            });
        }

        localStorage.setItem(DEPLOYMENT_KEY, JSON.stringify(all));
        return all.find(d => d.agentId === agentId);
    }
};
