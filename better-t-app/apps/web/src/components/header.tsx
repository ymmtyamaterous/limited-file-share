import { Share2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm shadow-sm">
      <div className="flex h-14 items-center justify-between px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-[0.95rem] tracking-tight text-foreground hover:opacity-80 transition-opacity"
        >
          <Share2 className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
          Limited File Share
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
