import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface LayoutContextType {
    pageTitle: string;
    pageDescription: string;
    headerActions: React.ReactNode;
    setPageDetails: (title: string, description?: string) => void;
    setPageActions: (actions: React.ReactNode) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const [pageTitle, setPageTitle] = useState("");
    const [pageDescription, setPageDescription] = useState("");
    const [headerActions, setPageActions] = useState<React.ReactNode>(null);

    const setPageDetails = useCallback((title: string, description?: string) => {
        setPageTitle(title);
        setPageDescription(description || "");
    }, []);

    return (
        <LayoutContext.Provider value={{ pageTitle, pageDescription, headerActions, setPageDetails, setPageActions }}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    const context = useContext(LayoutContext);
    if (context === undefined) {
        throw new Error("useLayout must be used within a LayoutProvider");
    }
    return context;
}

export function usePageTitle(title: string, description?: string) {
    const { setPageDetails } = useLayout();

    useEffect(() => {
        setPageDetails(title, description);
    }, [title, description, setPageDetails]);
}

export function usePageActions(actions: React.ReactNode) {
    const { setPageActions } = useLayout();

    useEffect(() => {
        setPageActions(actions);
        return () => setPageActions(null);
    }, [actions, setPageActions]);
}
