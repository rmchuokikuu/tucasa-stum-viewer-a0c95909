import { useLocation } from "react-router-dom";
import { useEffect, useState, ReactNode } from "react";

const EXIT_DURATION = 260;

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [stage, setStage] = useState<"in" | "out">("in");

  useEffect(() => {
    setStage("out");
    const timeout = window.setTimeout(() => {
      setDisplayChildren(children);
      setStage("in");
    }, EXIT_DURATION);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    setDisplayChildren(children);
  }, [children]);

  return (
    <div className={`page-transition ${stage === "in" ? "page-transition-in" : "page-transition-out"}`}>
      {displayChildren}
    </div>
  );
}
