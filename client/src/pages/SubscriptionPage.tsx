import React from 'react';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

export default function SubscriptionPage() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 lg:p-8 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0A2540 0%, #1B4361 100%)' }}>

            {/* Animated Grid Background */}
            <div className="absolute inset-0 z-0 opacity-[0.05] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }}
            />

            <div className="relative z-10 max-w-lg w-full bg-[#0f172a]/80 backdrop-blur-md rounded-3xl p-8 lg:p-12 border border-white/10 text-center shadow-2xl">
                <h1 className="text-3xl font-bold text-white mb-4">Contact Sales</h1>
                <p className="text-white/70 mb-8">
                    We are currently updating our subscription infrastructure. To upgrade your plan or learn more about our enterprise features, please contact our sales team directly.
                </p>

                <a href="mailto:sales@veltro.co.uk">
                    <Button size="lg" className="w-full bg-[#D97706] hover:bg-[#D97706]/90 text-white font-semibold text-lg h-12">
                        <Mail className="mr-2 h-5 w-5" /> Contact Sales
                    </Button>
                </a>
            </div>
        </div>
    );
}
