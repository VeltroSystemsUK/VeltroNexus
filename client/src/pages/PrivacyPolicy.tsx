import logoChrome from "@assets/logo-chrome.png";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-background">
            <header className="border-b border-[#1e293b] bg-[#0f172a] sticky top-0 z-50 shadow-sm">
                <div className="container mx-auto px-4 md:px-6 py-3 md:py-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <img
                                src={logoChrome}
                                alt="Veltro"
                                className="h-8 md:h-10 object-contain cursor-pointer"
                            />
                        </Link>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Link href="/auth">
                            <Button>Sign In</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 md:px-6 py-10 max-w-4xl">
                <h1 className="text-3xl md:text-4xl font-bold mb-8">Privacy Policy</h1>

                <div className="prose dark:prose-invert max-w-none space-y-6">
                    <p className="text-muted-foreground text-lg">
                        Last Updated: January 17, 2026
                    </p>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                        <p>
                            Veltro ("we", "our", or "us") respects your privacy and is committed to protecting it through our compliance with this policy.
                            This policy describes the types of information we may collect from you or that you may provide when you visit our website
                            and our practices for collecting, using, maintaining, protecting, and disclosing that information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">2. Cookies and Tracking Technologies</h2>
                        <p>
                            We use only "strictly necessary" cookies and similar technologies to provide the functionality of our application.
                            We do not use cookie-based tracking for advertising or third-party analytics.
                        </p>
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>
                                <strong>Authentication Cookies:</strong> We use secure session cookies to identify you when you log in and to maintain your session.
                                These are essential for the operation of the website.
                            </li>
                            <li>
                                <strong>Payment Processing:</strong> We use Stripe to process payments. Stripe may use cookies or similar technologies for
                                fraud detection and prevention, which are considered essential for secure transactions.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">3. Data Collection</h2>
                        <p>
                            We collect information you provide directly to us when you:
                        </p>
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>Register an account (email, name, password).</li>
                            <li>Complete your profile or upload branding assets.</li>
                            <li>Input prospect and submission data into our system.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">4. Data Usage</h2>
                        <p>
                            We use your data solely to:
                        </p>
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>Provide and maintain the Service.</li>
                            <li>Process your transactions.</li>
                            <li>Notify you about changes to our Service.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold mb-4">5. Contact Us</h2>
                        <p>
                            If you have any questions about this Privacy Policy, please contact us support.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
}
