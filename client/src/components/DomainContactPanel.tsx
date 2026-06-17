import React, { useState, useCallback } from "react";
import { EmailLink } from "@/components/EmailLink";

// ─── Types (mirror the function types) ───────────────────────────────────────

interface EmailContact {
    email: string;
    source: string;
    context: string;
    isGeneric: boolean;
}

interface PageResult {
    url: string;
    status: "ok" | "error" | "skipped";
    emailsFound: number;
    phonesFound: number;
}

interface ScrapeResult {
    domain: string;
    scrapedAt: string;
    emails: EmailContact[];
    phones: string[];
    names: string[];
    linkedInUrl: string | null;
    pagesScraped: string[];
    pageResults: PageResult[];
    status: "success" | "partial" | "failed";
    error?: string;
}

type ScrapeStatus = "idle" | "loading" | "success" | "error";

// ─── Sub-components ───────────────────────────────────────────────────────────

const Badge: React.FC<{ label: string; variant?: "green" | "amber" | "red" | "blue" | "grey" }> = ({
    label,
    variant = "grey",
}) => {
    const colours = {
        green: "background:#dcfce7;color:#166534;border:1px solid #bbf7d0",
        amber: "background:#fef9c3;color:#854d0e;border:1px solid #fde68a",
        red: "background:#fee2e2;color:#991b1b;border:1px solid #fecaca",
        blue: "background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe",
        grey: "background:#f3f4f6;color:#374151;border:1px solid #e5e7eb",
    };
    return (
        <span
            style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 9999,
                fontSize: 11,
                fontWeight: 600,
                ...Object.fromEntries(
                    colours[variant as keyof typeof colours].split(";").map((s: string) => {
                        const [k, v] = s.split(":");
                        const camel = k.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
                        return [camel, v];
                    })
                ),
            }}
        >
            {label}
        </span>
    );
};

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };
    return (
        <button
            onClick={copy}
            title="Copy"
            style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 11,
                color: copied ? "#16a34a" : "#6b7280",
                fontWeight: 500,
            }}
        >
            {copied ? "✓" : "Copy"}
        </button>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface DomainContactPanelProps {
    /** The domain to scrape, e.g. "example.co.uk" */
    domain: string;
    /** Optional contact name for email guessing */
    contactName?: string;
    /** Optional callback when a contact is selected/saved */
    onSaveContact?: (contact: EmailContact) => void;
}

export const DomainContactPanel: React.FC<DomainContactPanelProps> = ({
    domain,
    contactName,
    onSaveContact,
}: DomainContactPanelProps) => {
    const [status, setStatus] = useState<ScrapeStatus>("idle");
    const [result, setResult] = useState<ScrapeResult | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [showPageLog, setShowPageLog] = useState(false);

    const runScrape = useCallback(async () => {
        if (!domain) return;
        setStatus("loading");
        setResult(null);
        setErrorMessage("");

        try {
            const response = await fetch("/api/crm/scrape-domain", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain, contactName }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(err.error || "Scrape failed");
            }
            const data: ScrapeResult = await response.json();
            setResult(data);
            setStatus("success");
        } catch (err: unknown) {
            console.error("Scrape error:", err);
            const msg = err instanceof Error ? err.message : "An unexpected error occurred";
            setErrorMessage(msg);
            setStatus("error");
        }
    }, [domain, contactName]);

    // ── Idle State ──
    if (status === "idle") {
        return (
            <div style={styles.panel}>
                <div style={styles.idleRow}>
                    <span style={styles.domainLabel}>{domain}</span>
                    <button style={styles.scrapeBtn} onClick={runScrape}>
                        🔍 Find Contacts
                    </button>
                </div>
            </div>
        );
    }

    // ── Loading State ──
    if (status === "loading") {
        return (
            <div style={styles.panel}>
                <div style={styles.loadingRow}>
                    <div style={styles.spinner} />
                    <span style={styles.loadingText}>
                        Scanning {domain} — checking up to 15 pages…
                    </span>
                </div>
            </div>
        );
    }

    // ── Error State ──
    if (status === "error") {
        return (
            <div style={{ ...styles.panel, borderColor: "#fca5a5" }}>
                <div style={styles.errorRow}>
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>
                        ⚠ Scrape failed
                    </span>
                    <span style={{ color: "#6b7280", fontSize: 13 }}>{errorMessage}</span>
                    <button style={styles.retryBtn} onClick={runScrape}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // ── Results State ──
    if (!result) return null;

    const totalContacts = result.emails.length + result.phones.length;
    const personalEmails = result.emails.filter((e: EmailContact) => !e.isGeneric);
    const genericEmails = result.emails.filter((e: EmailContact) => e.isGeneric);

    return (
        <div style={styles.panel}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <span style={styles.domainLabel}>{domain}</span>
                    <Badge
                        label={
                            result.status === "success"
                                ? `${totalContacts} contacts found`
                                : result.status === "partial"
                                    ? "Partial results"
                                    : "No contacts found"
                        }
                        variant={
                            result.status === "success"
                                ? "green"
                                : result.status === "partial"
                                    ? "amber"
                                    : "red"
                        }
                    />
                    <span style={styles.timestamp}>
                        {new Date(result.scrapedAt).toLocaleTimeString("en-GB")}
                    </span>
                </div>
                <button style={styles.rescanBtn} onClick={runScrape}>
                    ↻ Rescan
                </button>
            </div>

            {/* Personal Emails */}
            {personalEmails.length > 0 && (
                <Section title="Personal Emails" count={personalEmails.length}>
                    {personalEmails.map((contact) => (
                        <ContactRow
                            key={contact.email}
                            contact={contact}
                            onSave={onSaveContact}
                        />
                    ))}
                </Section>
            )}

            {/* Generic Emails */}
            {genericEmails.length > 0 && (
                <Section title="Generic Emails" count={genericEmails.length} muted>
                    {genericEmails.map((contact) => (
                        <ContactRow
                            key={contact.email}
                            contact={contact}
                            onSave={onSaveContact}
                        />
                    ))}
                </Section>
            )}

            {/* Phone Numbers */}
            {result.phones.length > 0 && (
                <Section title="Phone Numbers" count={result.phones.length}>
                    {result.phones.map((phone) => (
                        <div key={phone} style={styles.contactRow}>
                            <span style={styles.contactValue}>📞 {phone}</span>
                            <CopyButton value={phone} />
                            <a href={`tel:${phone}`} style={styles.actionLink}>
                                Call
                            </a>
                        </div>
                    ))}
                </Section>
            )}

            {/* Named Individuals */}
            {result.names.length > 0 && (
                <Section title="Named Individuals" count={result.names.length}>
                    <div style={styles.nameGrid}>
                        {result.names.map((name) => (
                            <span key={name} style={styles.nameChip}>
                                {name}
                            </span>
                        ))}
                    </div>
                </Section>
            )}

            {/* LinkedIn */}
            {result.linkedInUrl && (
                <Section title="LinkedIn">
                    <a
                        href={result.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.linkedInLink}
                    >
                        🔗 {result.linkedInUrl.replace("https://www.linkedin.com/company/", "")}
                    </a>
                </Section>
            )}

            {/* No results */}
            {totalContacts === 0 && (
                <div style={styles.emptyState}>
                    <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
                        No contacts found across {result.pagesScraped.length} pages. The
                        site may block scrapers or have no publicly listed contacts.
                    </p>
                </div>
            )}

            {/* Page log toggle */}
            <div style={styles.logToggle}>
                <button
                    style={styles.logToggleBtn}
                    onClick={() => setShowPageLog((v) => !v)}
                >
                    {showPageLog ? "▲ Hide" : "▼ Show"} page log (
                    {result.pagesScraped.length} pages)
                </button>
            </div>

            {showPageLog && (
                <div style={styles.pageLog}>
                    {result.pageResults.map((pr) => (
                        <div key={pr.url} style={styles.pageLogRow}>
                            <span
                                style={{
                                    ...styles.pageLogStatus,
                                    color:
                                        pr.status === "ok"
                                            ? "#16a34a"
                                            : pr.status === "error"
                                                ? "#dc2626"
                                                : "#9ca3af",
                                }}
                            >
                                {pr.status === "ok" ? "✓" : pr.status === "error" ? "✗" : "–"}
                            </span>
                            <span style={styles.pageLogUrl}>
                                {pr.url.replace(result.domain, "")}
                            </span>
                            {pr.status === "ok" && (
                                <span style={styles.pageLogStats}>
                                    {pr.emailsFound > 0 && `${pr.emailsFound} email${pr.emailsFound > 1 ? "s" : ""}`}
                                    {pr.emailsFound > 0 && pr.phonesFound > 0 && " · "}
                                    {pr.phonesFound > 0 && `${pr.phonesFound} phone${pr.phonesFound > 1 ? "s" : ""}`}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{
    title: string;
    count?: number;
    muted?: boolean;
    children: React.ReactNode;
}> = ({ title, count, muted, children }) => (
    <div style={styles.section}>
        <div style={styles.sectionHeader}>
            <span style={{ ...styles.sectionTitle, opacity: muted ? 0.6 : 1 }}>
                {title}
            </span>
            {count !== undefined && (
                <Badge label={String(count)} variant={muted ? "grey" : "blue"} />
            )}
        </div>
        {children}
    </div>
);

// ─── Contact row ──────────────────────────────────────────────────────────────

const ContactRow: React.FC<{
    contact: EmailContact;
    onSave?: (contact: EmailContact) => void;
}> = ({ contact, onSave }) => {
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        if (onSave) {
            onSave(contact);
            setSaved(true);
        }
    };

    return (
        <div style={styles.contactRow}>
            <div style={styles.contactMain}>
                <span style={styles.contactValue}>{contact.email}</span>
                <span style={styles.contactSource}>via {contact.source}</span>
            </div>
            <div style={styles.contactActions}>
                <CopyButton value={contact.email} />
                <EmailLink
                    email={contact.email}
                    className="no-underline text-[11px] font-medium px-1.5 text-blue-600 hover:text-blue-800"
                >
                    Email
                </EmailLink>
                {onSave && (
                    <button
                        style={{
                            ...styles.saveBtn,
                            background: saved ? "#dcfce7" : "#eff6ff",
                            color: saved ? "#16a34a" : "#2563eb",
                        }}
                        onClick={handleSave}
                        disabled={saved}
                    >
                        {saved ? "✓ Saved" : "+ Save"}
                    </button>
                )}
            </div>
            {contact.context && (
                <div style={styles.contactContext}>{contact.context}</div>
            )}
        </div>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    panel: {
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 13,
    },
    idleRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
    },
    domainLabel: {
        fontWeight: 600,
        color: "#111827",
        fontSize: 13,
    },
    scrapeBtn: {
        background: "#2563eb",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        padding: "6px 14px",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
    },
    loadingRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
    },
    spinner: {
        width: 16,
        height: 16,
        border: "2px solid #e5e7eb",
        borderTopColor: "#2563eb",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
    },
    loadingText: {
        color: "#6b7280",
        fontSize: 13,
    },
    errorRow: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        flexWrap: "wrap" as const,
    },
    retryBtn: {
        background: "#fee2e2",
        color: "#dc2626",
        border: "none",
        borderRadius: 6,
        padding: "4px 10px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        borderBottom: "1px solid #f3f4f6",
        background: "#fafafa",
    },
    headerLeft: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap" as const,
    },
    timestamp: {
        color: "#9ca3af",
        fontSize: 11,
    },
    rescanBtn: {
        background: "none",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: "4px 10px",
        cursor: "pointer",
        fontSize: 12,
        color: "#374151",
        fontWeight: 500,
    },
    section: {
        padding: "10px 14px",
        borderBottom: "1px solid #f3f4f6",
    },
    sectionHeader: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    sectionTitle: {
        fontWeight: 600,
        color: "#374151",
        fontSize: 12,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
    },
    contactRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "6px 0",
        borderBottom: "1px solid #f9fafb",
        flexWrap: "wrap" as const,
    },
    contactMain: {
        flex: 1,
        minWidth: 0,
    },
    contactValue: {
        fontWeight: 500,
        color: "#111827",
        display: "block",
    },
    contactSource: {
        color: "#9ca3af",
        fontSize: 11,
    },
    contactActions: {
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
    },
    contactContext: {
        width: "100%",
        color: "#6b7280",
        fontSize: 11,
        fontStyle: "italic",
        marginTop: 2,
        paddingLeft: 0,
        lineHeight: 1.4,
    },
    actionLink: {
        color: "#2563eb",
        textDecoration: "none",
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 6px",
    },
    saveBtn: {
        border: "none",
        borderRadius: 4,
        padding: "2px 8px",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 600,
    },
    nameGrid: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: 6,
    },
    nameChip: {
        background: "#f3f4f6",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: "3px 10px",
        fontSize: 12,
        color: "#374151",
        fontWeight: 500,
    },
    linkedInLink: {
        color: "#0a66c2",
        textDecoration: "none",
        fontWeight: 500,
        fontSize: 13,
    },
    emptyState: {
        padding: "16px 14px",
        background: "#fafafa",
    },
    logToggle: {
        padding: "8px 14px",
        background: "#fafafa",
    },
    logToggleBtn: {
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "#9ca3af",
        fontSize: 11,
        padding: 0,
    },
    pageLog: {
        padding: "4px 14px 10px",
        background: "#fafafa",
    },
    pageLogRow: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 0",
        fontSize: 11,
    },
    pageLogStatus: {
        fontWeight: 700,
        width: 12,
        flexShrink: 0,
    },
    pageLogUrl: {
        color: "#6b7280",
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
    },
    pageLogStats: {
        color: "#16a34a",
        fontWeight: 500,
        flexShrink: 0,
    },
};
