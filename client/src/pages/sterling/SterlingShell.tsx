import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { STERLING_DAILY_NAV, sterlingNavActive } from "@shared/sterlingPortal";
import "./sterling.css";

export function SterlingShell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { user, role, logoutMutation } = useAuth();
  const [location] = useLocation();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Sterling";
  const oversight = role === "super_admin" || role === "sales_admin";

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => {
      requestAnimationFrame(() => {
        if (!document.querySelector(".scf") && hadDark) root.classList.add("dark");
      });
    };
  }, []);

  return (
    <div className="scf">
      <header className="scf-top">
        <Link href="/broker-portal" className="scf-home" data-testid="link-sterling-home">
          <img className="scf-logo" src="/images/sterling-commercial-finance-logo.png" alt="Sterling Commercial Finance" />
          <span>Sterling portal</span>
        </Link>
        <nav className="scf-nav" aria-label="Sterling daily desks">
          {STERLING_DAILY_NAV.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={sterlingNavActive(location, item.path) ? "on" : undefined}
              data-testid={item.testId}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="scf-who">
          <span>{oversight ? `${name} · oversight` : name}</span>
          {oversight ? <Link href="/pipeline">Back to Nexus</Link> : null}
          <Link href="/broker-portal/settings">Settings</Link>
          <button type="button" onClick={() => logoutMutation.mutate()}>
            Sign out
          </button>
        </div>
      </header>
      <div className={wide ? "scf-ops" : "scf-main"}>{children}</div>
      {!wide ? <footer className="scf-foot">Sterling Commercial Finance Limited. Confidential.</footer> : null}
    </div>
  );
}
