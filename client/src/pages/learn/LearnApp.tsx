import { useEffect, type ReactNode } from "react";
import { Link, Route, Switch } from "wouter";
import LearnHome, {
  EXPLORE_URL,
  LEARN_MAIL,
  LearnNotFound,
  PackagerLine,
  setLearnMeta,
} from "./LearnHome";
import LearnAsk from "./LearnAsk";
import LearnLibrary from "./LearnLibrary";
import LearnNews from "./LearnNews";
import LearnNewsPost from "./LearnNewsPost";
import LearnPiece from "./LearnPiece";

function LearnShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    setLearnMeta(
      "Strata Learn",
      "Training and a director's handbook for UK companies in trouble. Strata packages; it does not lend.",
    );
  }, []);

  return (
    <div className="dark min-h-screen bg-[#0A0B0D] text-zinc-100 font-['Plus_Jakarta_Sans']">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="font-['Unbounded'] text-lg tracking-tight">
            <span className="chrome-text">Strata</span> Learn
          </Link>
          <nav className="flex items-center gap-5 text-sm text-zinc-400">
            <Link href="/" className="hover:text-emerald-400">
              Start here
            </Link>
            <Link href="/library#handbook" className="hover:text-emerald-400">
              Handbook
            </Link>
            <Link href="/library" className="hover:text-emerald-400">
              Library
            </Link>
            <Link href="/news" className="hover:text-emerald-400">
              News
            </Link>
            <Link href="/ask" className="hover:text-emerald-400">
              Ask
            </Link>
            <a href={EXPLORE_URL} className="hover:text-emerald-400">
              Explore
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-8 space-y-3 text-sm text-zinc-500">
          <PackagerLine />
          <p>Privacy — no accounts on this host. Training only.</p>
          <p>
            <a href={`mailto:${LEARN_MAIL}`} className="hover:text-emerald-400">
              {LEARN_MAIL}
            </a>
            {" · "}
            <a href={EXPLORE_URL} className="hover:text-emerald-400">
              Explore
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function WatchPiece() {
  return <LearnPiece kind="video" />;
}

function ReadPiece() {
  return <LearnPiece kind="article" />;
}

export default function LearnApp() {
  return (
    <LearnShell>
      <Switch>
        <Route path="/" component={LearnHome} />
        <Route path="/library" component={LearnLibrary} />
        <Route path="/news/:slug" component={LearnNewsPost} />
        <Route path="/news" component={LearnNews} />
        <Route path="/ask" component={LearnAsk} />
        <Route path="/watch/:slug" component={WatchPiece} />
        <Route path="/read/:slug" component={ReadPiece} />
        <Route>
          <LearnNotFound />
        </Route>
      </Switch>
    </LearnShell>
  );
}
