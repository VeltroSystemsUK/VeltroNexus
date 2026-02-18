import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User, Sparkles, BookOpen, Shield, AlertTriangle, X, Check } from "lucide-react";
import { complianceResources } from "@/data/complianceResources";

// --- Types ---

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    citations?: Array<{
        title: string;
        source: string;
        id: string;
    }>;
    options?: Array<{
        label: string;
        value: string;
        action?: string;
        next_state?: string;
    }>;
}

interface WorkflowState {
    description: string;
    bot_message: string;
    match_keywords?: string[];
    options?: Array<{ label: string; next_state: string; action?: string }>;
    input_requirements?: Record<string, string | string[]>;
    next_state?: string;
    logic_execution?: Record<string, string>;
    branches?: Array<{ condition: string; outcome: string; next_state: string }>;
    action?: string;
}

interface Workflow {
    workflow_id: string;
    trigger_keywords: string[];
    initial_state: string;
    states: Record<string, WorkflowState>;
}

// --- Workflow Definition: BREACH_REPORTING_V1 ---
const BREACH_REPORTING_WORKFLOW: Workflow = {
    workflow_id: "BREACH_REPORTING_V1",
    trigger_keywords: ["overcharged", "breach", "error", "forgot to", "missed deadline", "complaint", "incident"],
    initial_state: "STATE_TRIAGE",
    states: {
        "STATE_TRIAGE": {
            description: "Immediate containment of the issue.",
            bot_message: "⚠️ **Compliance Incident Detected.** \n\nI have switched to 'Incident Mode'. \n\n**IMMEDIATE ACTION:** Please stop any further processing or communication regarding this specific file/client until we assess the scope. \n\nAre you ready to assess the materiality of this breach?",
            options: [
                { label: "Yes, start assessment", next_state: "STATE_GATHER_FACTS" },
                { label: "No, just searching for info", next_state: "EXIT_TO_SEARCH" }
            ]
        },
        "STATE_GATHER_FACTS": {
            description: "Collecting data points for the SUP 15.3 materiality test.",
            bot_message: "I need 3 key facts to determine if this is a 'Reportable Breach' to the FCA:\n\n1. **Volume:** How many customers are affected? (Approx number)\n2. **Value:** What is the total estimated financial loss/detriment (£)?\n3. **Cause:** Is this a 'Systemic' issue (e.g., IT error) or 'Isolated' (Human error)?\n\nPlease enter the details below (e.g., '10 customers, £500, isolated').",
            input_requirements: {
                customer_count: "integer",
                financial_loss: "currency",
                issue_type: ["systemic", "isolated"] as unknown as string
            },
            next_state: "STATE_EVALUATE_MATERIALITY"
        },
        "STATE_EVALUATE_MATERIALITY": {
            description: "The logic engine that decides the risk level.",
            bot_message: "Evaluating materiality...",
            next_state: "Calculated dynamically"
        },
        "STATE_ADVISE_REPORTING": {
            description: "Guidance for high-risk breaches.",
            bot_message: "🚨 **Result: MATERIAL BREACH DETECTED**\n\nBased on the volume/value, this meets the criteria for immediate notification under **SUP 15.3.11R**.\n\n**Required Actions:**\n1. You must notify the FCA (usually via Connect or your supervisor).\n2. We must initiate a Redress Plan immediately.",
            next_state: "STATE_REMEDIATION_PLAN"
        },
        "STATE_ADVISE_INTERNAL_LOG": {
            description: "Guidance for minor breaches.",
            bot_message: "✅ **Result: Minor (Non-Material) Breach**\n\nThis appears to fall below the threshold for immediate FCA notification. However, you **must** record this in your internal Breach Register to demonstrate 'Openness & Cooperation' (Principle 11).",
            next_state: "STATE_REMEDIATION_PLAN"
        },
        "STATE_REMEDIATION_PLAN": {
            description: "Fixing the consumer detriment.",
            bot_message: "Now, let's fix this for the customer.\n\n**Remediation Steps:**\n1. **Refund:** Return any financial loss.\n2. **Interest:** Add 8% simple interest per annum (FOS standard).\n3. **Apology:** Send a formal letter.\n\nWould you like me to generate the **Apology & Refund Letter** template now?",
            options: [
                { label: "Yes, generate letter", action: "GENERATE_DOC_TEMPLATE", next_state: "STATE_ROOT_CAUSE_CATEGORY" },
                { label: "No, skip", next_state: "STATE_ROOT_CAUSE_CATEGORY" }
            ]
        },
        // Updated Root Cause Category State
        "STATE_ROOT_CAUSE_CATEGORY": {
            description: "Selecting root cause category.",
            bot_message: "Final Step: We need to analyze the root cause to prevent recurrence.\n\nWhat was the primary category of failure?",
            // Options will be populated dynamically from taxonomy
            next_state: "STATE_ROOT_CAUSE_SUB_CAUSE"
        },
        // Updated Sub Cause State
        "STATE_ROOT_CAUSE_SUB_CAUSE": {
            description: "Selecting specific sub-cause.",
            bot_message: "Please select the specific underlying cause:",
            // Options will be populated dynamically
            next_state: "STATE_LOG_AND_CLOSE"
        },
        "STATE_LOG_AND_CLOSE": {
            description: "Saving the record to the database.",
            action: "SAVE_TO_DB",
            bot_message: "💾 **Incident Logged.**\n\n**Root Cause:** {{root_cause}} - {{sub_cause}}\n**Action:** {{recommended_action}}\n\nI have saved this to your Compliance Register (ID: #BREACH_{{timestamp}}).",
            next_state: "IDLE"
        },
        "EXIT_TO_SEARCH": {
            description: "Exit workflow",
            bot_message: "Okay, exiting Incident Mode. How else can I help you?",
            next_state: "IDLE"
        }
    }
};

export function RegulatoryAssistant() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Hello! I'm your FCA Compliance Assistant. I can help you find regulations, understand retention policies, and clarify your obligations. What would you like to know?",
        },
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // State Machine State
    const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
    const [currentStateId, setCurrentStateId] = useState<string | null>(null);
    const [workflowContext, setWorkflowContext] = useState<any>({});

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleSend = (overrideInput?: string) => {
        const textToSend = overrideInput || input;
        if (!textToSend.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: textToSend,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);

        // Logic processing
        // Logic processing
        if (activeWorkflow && currentStateId) {
            setTimeout(() => handleWorkflowStep(textToSend), 1000);
        } else {
            // Check for triggers regarding workflows first
            const triggeredWorkflow = checkForWorkflowTriggers(textToSend);
            if (triggeredWorkflow) {
                setTimeout(() => startWorkflow(triggeredWorkflow), 1000);
            } else {
                // Call Backend API for Exa + Gemini
                fetch("/api/compliance/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: textToSend }),
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.error) throw new Error(data.error);

                        setMessages((prev) => [...prev, {
                            id: Date.now().toString(),
                            role: "assistant",
                            content: data.answer,
                            citations: data.citations
                        }]);
                    })
                    .catch(err => {
                        console.error("Compliance Chat failed", err);
                        setMessages((prev) => [...prev, {
                            id: Date.now().toString(),
                            role: "assistant",
                            content: "I'm having trouble connecting to the regulatory database right now. Please try again later.",
                        }]);
                    })
                    .finally(() => setIsTyping(false));
            }
        }
    };

    const checkForWorkflowTriggers = (text: string): Workflow | null => {
        const lowerText = text.toLowerCase();
        if (BREACH_REPORTING_WORKFLOW.trigger_keywords.some(k => lowerText.includes(k))) {
            return BREACH_REPORTING_WORKFLOW;
        }
        return null;
    };

    const startWorkflow = (workflow: Workflow) => {
        setActiveWorkflow(workflow);
        const initialStateId = workflow.initial_state;
        setCurrentStateId(initialStateId);
        setWorkflowContext({});

        const stateDef = workflow.states[initialStateId];

        const response: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: stateDef.bot_message,
            options: stateDef.options?.map(o => ({ label: o.label, value: o.label }))
        };

        setMessages(prev => [...prev, response]);
        setIsTyping(false);
    };

    const handleWorkflowStep = (userInput: string) => {
        if (!activeWorkflow || !currentStateId) return;

        const currentState = activeWorkflow.states[currentStateId];
        let nextStateId = currentState.next_state;

        // 1. Handle Options/Branches
        if (currentState.options) {
            const selectedOption = currentState.options.find(o => o.label.toLowerCase() === userInput.toLowerCase());
            if (selectedOption) {
                nextStateId = selectedOption.next_state;
                if (selectedOption.action === "GENERATE_DOC_TEMPLATE") {
                    setTimeout(() => {
                        setMessages(prev => [...prev, {
                            id: Date.now().toString() + "_doc",
                            role: "assistant",
                            content: "📄 **Generated Template: Apology & Refund Letter**\n\n[Download Template.docx](#) (Mock Link)"
                        }]);
                    }, 500);
                }
            }
        }

        // Dynamic Options Handling for Root Cause
        if (currentStateId === "STATE_ROOT_CAUSE_CATEGORY") {
            // User input is the category label
            const selectedCategory = complianceResources.root_cause_taxonomy?.categories.find(c => c.label === userInput);
            if (selectedCategory) {
                setWorkflowContext((prev: any) => ({ ...prev, rootCauseCategory: selectedCategory }));
                nextStateId = "STATE_ROOT_CAUSE_SUB_CAUSE";
            }
        }

        if (currentStateId === "STATE_ROOT_CAUSE_SUB_CAUSE") {
            const category = workflowContext.rootCauseCategory;
            const selectedSubCause = category?.sub_causes.find((sc: any) => sc.label === userInput);
            if (selectedSubCause) {
                setWorkflowContext((prev: any) => ({ ...prev, rootCauseSubCause: selectedSubCause }));
                nextStateId = "STATE_LOG_AND_CLOSE";
            }
        }

        // 2. Handle Inputs & Context Gathering
        if (currentStateId === "STATE_GATHER_FACTS") {
            const customerCount = parseInt(userInput.match(/(\d+)\s*cust/i)?.[1] || "0") || (userInput.includes("10") ? 10 : 0);
            const financialLoss = parseInt(userInput.match(/£?(\d+)/)?.[1] || "0") || 0;
            const isSystemic = userInput.toLowerCase().includes("systemic");

            setWorkflowContext({ ...workflowContext, customerCount, financialLoss, isSystemic });

            nextStateId = "STATE_EVALUATE_MATERIALITY";
        }

        // 3. Handle Logic Evaluation States 
        if (nextStateId === "STATE_EVALUATE_MATERIALITY") {
            const count = parseInt(userInput.match(/(\d+)/)?.[0] || "0");
            const loss = parseInt(userInput.match(/£(\d+)/)?.[1] || userInput.match(/(\d+)/g)?.[1] || "0");
            const systemic = userInput.toLowerCase().includes("systemic");

            const isMaterial = (loss > 5000 || count > 50 || systemic);

            nextStateId = isMaterial ? "STATE_ADVISE_REPORTING" : "STATE_ADVISE_INTERNAL_LOG";
        }

        // 4. Transition
        if (nextStateId === "IDLE" || !nextStateId) {

            if (currentStateId === "STATE_LOG_AND_CLOSE" || nextStateId === "IDLE") {
                const stateDef = activeWorkflow.states["STATE_LOG_AND_CLOSE"]; // Force using this definition for exit msg if we are here
                let msg = stateDef.bot_message.replace("{{timestamp}}", Date.now().toString());

                if (workflowContext.rootCauseCategory && workflowContext.rootCauseSubCause) {
                    msg = msg
                        .replace("{{root_cause}}", workflowContext.rootCauseCategory.label)
                        .replace("{{sub_cause}}", workflowContext.rootCauseSubCause.label)
                        .replace("{{recommended_action}}", workflowContext.rootCauseSubCause.recommended_action);
                }

                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: "assistant",
                    content: msg
                }]);
            }

            setActiveWorkflow(null);
            setCurrentStateId(null);
            setWorkflowContext({});
            setIsTyping(false);
            return;
        }

        // Normal transition
        setCurrentStateId(nextStateId);
        const nextStateDef = activeWorkflow.states[nextStateId];

        if (nextStateDef) {
            let msgContent = nextStateDef.bot_message;
            // Format message with context
            if (msgContent.includes("{{financial_loss}}")) {
                const loss = userInput.match(/£?(\d+)/)?.[1] || "0";
                msgContent = msgContent.replace("{{financial_loss}}", loss);
            }

            // Determine Options
            let options = nextStateDef.options?.map(o => ({ label: o.label, value: o.label }));

            // Dynamic Options for Root Cause
            if (nextStateId === "STATE_ROOT_CAUSE_CATEGORY") {
                options = complianceResources.root_cause_taxonomy?.categories.map(c => ({
                    label: c.label,
                    value: c.label
                }));
            }

            if (nextStateId === "STATE_ROOT_CAUSE_SUB_CAUSE") {
                const category = workflowContext.rootCauseCategory; // This won't be set yet if we just transitioned INTO this state from CATEGORY selection in same tick? 
                // Wait, logic above updated context in Step 1.
                // Actually, if we just transitioned to SUB_CAUSE, it means we handled CATEGORY input in Step 1.
                // So context IS updated.
                if (category) {
                    options = category.sub_causes.map((sc: any) => ({
                        label: sc.label,
                        value: sc.label
                    }));
                }
            }

            const nextResponse: Message = {
                id: Date.now().toString(),
                role: "assistant",
                content: msgContent,
                options: options
            };
            setMessages(prev => [...prev, nextResponse]);

        }

        setIsTyping(false);
    };


    // ... generateSearchResponse remains same ...
    const generateSearchResponse = (query: string): Message => {
        const lowerQuery = query.toLowerCase();
        const citations: Message["citations"] = [];
        let responseText = "";

        const keywords = {
            retention: ["retention", "how long", "keep", "store"],
            complaints: ["complaint", "dissatisfaction", "ombudsman", "fos"],
            vulnerable: ["vulnerable", "vulnerability", "health", "capability"],
            aml: ["aml", "money laundering", "sanctions", "financial crime", "crime", "pep"],
            gdpr: ["gdpr", "privacy", "data", "protection"],
            idd: ["idd", "initial disclosure", "terms", "business"],
        };

        let foundDocs: any[] = [];

        // Search in Documents
        complianceResources.document_categories.forEach(cat => {
            cat.documents.forEach(doc => {
                const docText = `${doc.title} ${doc.key_content_requirements.join(" ")}`.toLowerCase();
                if (lowerQuery.includes(doc.id.toLowerCase()) ||
                    Object.values(keywords).some(list => list.some(k => lowerQuery.includes(k) && docText.includes(k)))) {
                    foundDocs.push(doc);
                }
            });
        });

        // Deduplicate
        foundDocs = foundDocs.filter((doc, index, self) =>
            index === self.findIndex((d) => d.id === doc.id)
        );

        if (foundDocs.length > 0) {
            responseText = `I found ${foundDocs.length} relevant compliance resource${foundDocs.length > 1 ? 's' : ''} for your query.\n\n`;

            foundDocs.forEach(doc => {
                citations.push({
                    title: doc.title,
                    source: doc.regulatory_source,
                    id: doc.id
                });

                responseText += `**${doc.title} (${doc.id})**\n`;
                if (doc.retention_period) responseText += `• Retention Period: ${doc.retention_period}\n`;
                if (doc.mandatory_for) responseText += `• Mandatory For: ${doc.mandatory_for.join(", ").replace(/_/g, " ")}\n`;
                responseText += `\n`;
            });
        } else {
            responseText = "I couldn't find a specific document matching your query. Try asking about 'complaints', 'retention periods', 'AML', or type 'Report a breach' if you have an incident.";
        }

        return {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: responseText,
            citations: citations.length > 0 ? citations : undefined,
        };
    };

    return (
        <div className="grid gap-6 md:grid-cols-[1fr_300px] h-[calc(100vh-12rem)]">
            <Card className={`flex flex-col h-full border-2 shadow-lg transition-colors ${activeWorkflow ? "border-amber-500/50 bg-amber-50/10" : "border-primary/10"}`}>
                <CardHeader className={`border-b ${activeWorkflow ? "bg-amber-100/20" : "bg-muted/30"}`}>
                    <CardTitle className="flex items-center gap-2">
                        {activeWorkflow ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <Sparkles className="h-5 w-5 text-primary" />}
                        {activeWorkflow ? "Incident Response Mode" : "Regulatory Assistant"}
                    </CardTitle>
                    <CardDescription>
                        {activeWorkflow ? "Guided workflow active. Follow instructions below." : "AI expert on FCA regulations, retention policies, and compliance obligations."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 min-h-0 p-0 h-full">
                    <ScrollArea className="h-full">
                        <div className="space-y-4 p-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {msg.role === "assistant" && (
                                        <Avatar className={`h-8 w-8 border ${activeWorkflow ? "bg-amber-100" : "bg-primary/10"}`}>
                                            <AvatarFallback>
                                                {activeWorkflow && msg.id !== "welcome" ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <Bot className="h-4 w-4 text-primary" />}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div className={`max-w-[80%] space-y-2`}>
                                        <div
                                            className={`p-3 rounded-lg text-sm ${msg.role === "user"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted shadow-sm"
                                                }`}
                                        >
                                            <div className="whitespace-pre-wrap">{msg.content}</div>
                                        </div>

                                        {msg.options && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {msg.options.map((opt, i) => (
                                                    <Button
                                                        key={i}
                                                        variant="outline"
                                                        size="sm"
                                                        className="bg-background hover:bg-muted"
                                                        onClick={() => handleSend(opt.value)}
                                                    >
                                                        {opt.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}

                                        {msg.citations && (
                                            <div className="grid gap-2">
                                                {msg.citations.map((cite, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={cite.source}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 p-2 rounded bg-background border text-xs hover:bg-muted transition-colors cursor-pointer group"
                                                    >
                                                        <BookOpen className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                                                        <span className="font-medium truncate flex-1 text-primary underline-offset-4 group-hover:underline">
                                                            {cite.title}
                                                        </span>
                                                        <Badge variant="outline" className="text-[10px]">{cite.id}</Badge>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {msg.role === "user" && (
                                        <Avatar className="h-8 w-8 border bg-muted">
                                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex gap-3">
                                    <Avatar className="h-8 w-8 border bg-primary/10">
                                        <AvatarFallback><Bot className="h-4 w-4 text-primary" /></AvatarFallback>
                                    </Avatar>
                                    <div className="bg-muted p-3 rounded-lg flex items-center gap-1">
                                        <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>
                </CardContent>

                <CardFooter className="p-4 border-t bg-background">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="flex w-full gap-2"
                    >
                        {activeWorkflow && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                title="Cancel Workflow"
                                onClick={() => {
                                    setActiveWorkflow(null);
                                    setCurrentStateId(null);
                                    setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Workflow cancelled. Returning to standard mode." }]);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                        <Input
                            placeholder={activeWorkflow ? "Enter details or select an option..." : "Ask about regulations, or report an incident..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={isTyping}
                            className="flex-1"
                            id="compliance-query"
                            name="compliance-query"
                        />
                        <Button type="submit" size="icon" disabled={!input.trim() || isTyping}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>

            {/* Suggested Topics Sidebar */}
            <div className="hidden md:flex flex-col gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Suggested Topics</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2">
                        {[
                            "What is the retention period for complaints?",
                            "Tell me about Vulnerable Customer Policy",
                            "Who is the MLRO?",
                            "Report a compliance breach",
                            "I think we missed a deadline"
                        ].map((topic, i) => (
                            <Button
                                key={i}
                                variant="outline"
                                className="justify-start text-xs h-auto py-2 whitespace-normal text-left"
                                onClick={() => handleSend(topic)}
                            >
                                {topic}
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                {activeWorkflow ? (
                    <Card className="flex-1 bg-amber-50/50 border-amber-200">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                                <AlertTriangle className="h-4 w-4" />
                                Incident Mode Active
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-amber-800 leading-relaxed">
                                You are currently in a guided incident response workflow. The system is recording your inputs for the Compliance Register.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="flex-1 bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                <Shield className="h-4 w-4" />
                                Compliance Tip
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Always document your "fair value" assessments for every product. The FCA requires evidence that you have considered the target market and that the product offers fair value for the price paid.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
