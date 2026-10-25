import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { type ThemeMode, applyTheme, getStoredTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Menu, Moon, Sun } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

interface NavItem {
  to: string;
  label: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home" },
  { to: "/connect", label: "Connect" },
  { to: "/predict", label: "Predict" },
  { to: "/analyze-labs", label: "Analyze Labs" },
  { to: "/record", label: "My Record" },
  { to: "/symptoms", label: "Symptoms" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/privacy", label: "Privacy" },
];

function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    setMode(getStoredTheme());
  }, []);

  const isDark = mode === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-ocid="theme.toggle"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="tap-target rounded-full"
      onClick={() => {
        const next: ThemeMode = isDark ? "light" : "dark";
        applyTheme(next);
        setMode(next);
      }}
    >
      {isDark ? (
        <Sun aria-hidden="true" className="size-5" />
      ) : (
        <Moon aria-hidden="true" className="size-5" />
      )}
    </Button>
  );
}

function NavLinks({
  orientation,
  onNavigate,
}: {
  orientation: "horizontal" | "vertical";
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Primary"
      data-ocid="nav.menu"
      className={cn(
        orientation === "horizontal"
          ? "hidden items-center gap-1 md:flex"
          : "flex flex-col gap-1",
      )}
    >
      {NAV_ITEMS.map((item) => {
        const active =
          item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            data-ocid={`nav.link.${item.label.toLowerCase().replace(/\s+/g, "_")}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "tap-target flex items-center rounded-full px-3 text-sm font-medium transition-smooth",
              orientation === "vertical" && "w-full px-4 text-base",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** App shell: disclaimer banner, sticky header nav, content area, footer. */
export function Layout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <DisclaimerBanner />
      <header className="sticky top-[41px] z-30 border-b border-border bg-card/95 shadow-subtle backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            data-ocid="nav.brand_link"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-none"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
              <Activity aria-hidden="true" className="size-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              Vitals Ledger
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <NavLinks orientation="horizontal" />
            <ThemeToggle />
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-ocid="nav.open_menu_button"
                  aria-label="Open navigation menu"
                  className="tap-target rounded-full md:hidden"
                >
                  <Menu aria-hidden="true" className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-card">
                <SheetHeader>
                  <SheetTitle className="font-display">Menu</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6">
                  <NavLinks
                    orientation="vertical"
                    onNavigate={() => setMenuOpen(false)}
                  />
                  <SheetClose asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      data-ocid="nav.close_menu_button"
                      className="tap-target mt-4 w-full rounded-lg"
                    >
                      Close
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:py-10">
        {children}
      </main>

      <footer className="border-t border-border bg-muted/40 px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 text-xs text-muted-foreground">
          <p>
            Educational tool — not medical advice. Your health data stays in
            this browser and is never sent to a server.
          </p>
          <p>
            © {year}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
                typeof window !== "undefined" ? window.location.hostname : "",
              )}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-2"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
