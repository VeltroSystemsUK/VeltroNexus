import { useEffect } from "react";
import { PackagerLine, setLearnMeta } from "./LearnHome";
import LearnLibrarian from "./LearnLibrarian";

export default function LearnAsk() {
  useEffect(() => {
    setLearnMeta(
      "Ask the desk — Strata Learn",
      "Valid questions about published lessons. Strata packages; it does not lend.",
    );
  }, []);

  return (
    <div className="space-y-8">
      <PackagerLine />
      <LearnLibrarian variant="page" />
    </div>
  );
}
