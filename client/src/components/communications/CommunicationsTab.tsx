import React from "react";
import { SendMessageForm } from "./SendMessageForm";
import { CommunicationsList } from "./CommunicationsList";
import { Separator } from "@/components/ui/separator";

interface CommunicationsTabProps {
    prospectId: number;
    contacts: any[];
}

export const CommunicationsTab: React.FC<CommunicationsTabProps> = ({ prospectId, contacts }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <h3 className="text-lg font-semibold mb-4">Send Message</h3>
                <SendMessageForm prospectId={prospectId} contacts={contacts} />
            </div>
            <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold mb-4">History</h3>
                <CommunicationsList prospectId={prospectId} />
            </div>
        </div>
    );
};
