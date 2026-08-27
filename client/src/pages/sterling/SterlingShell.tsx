import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import "./sterling.css";

export function SterlingShell({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  const { user, role, logoutMutation } = useAuth();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Sterling";
  const oversight = role === "super_admin" || role === "sales_admin";

  return (
    <div className="scf">
      <header className="scf-top">
        <Link href="/broker-portal">
          <img className="scf-logo" src="/images/sterling-commercial-finance-logo.png" alt="Sterling Commercial Finance" />
        </Link>
        <div className="scf-who">
          <span>{oversight ? `${name} · oversight` : name}</span>
          {oversight ? <Link href="/pipeline">Back to Nexus</Link> : null}
          <Link href="/broker-portal/settings">Settings</Link>
          <button type="button" onClick={() => logoutMutation.mutate()}>
            Sign out
          </button>
        </div>
      </header>
      <div className={wide ? "" : "scf-main"}>{children}</div>
      {!wide ? <footer className="scf-foot">Sterling Commercial Finance Limited. Confidential.</footer> : null}
    </div>
  );
}
