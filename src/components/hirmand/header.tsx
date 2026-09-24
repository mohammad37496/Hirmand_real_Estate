import { useEffect, useState, type MouseEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronDown, Landmark, PiggyBank, WalletCards, Menu, X } from "lucide-react";
import { NAV, SITE, TEAM } from "@/lib/site";
import { cn } from "@/lib/utils";
import { CallMenu } from "./call-menu";
import { BrandLogo } from "./logo";
import { scrollToId } from "./scroll";

const FINANCE_NAV = [
  { id: "rahn", label: "رهن به اجاره", href: "/tools/rahn-rent", icon: ArrowLeftRight, text: "تبدیل ترکیب رهن و اجاره" },
  { id: "commission", label: "کمیسیون ملک", href: "/tools/commission", icon: WalletCards, text: "برآورد کمیسیون و مالیات" },
  { id: "deposit", label: "سود سپرده", href: "/tools/deposit", icon: PiggyBank, text: "محاسبه سود و مبلغ نهایی" },
  { id: "loan", label: "اقساط وام", href: "/tools/loan", icon: Landmark, text: "قسط، سود و جمع پرداختی" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (pathname.startsWith("/tools/")) setFinanceOpen(true);
  }, [pathname]);

  function goHash(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (onHome) {
      scrollToId(event, id, closeMenu);
      return;
    }
    closeMenu();
  }

  return (
    <header className={cn("site-nav", (scrolled || !onHome) && "is-scrolled")}>
      <div className="site-nav-inner">
        <Link to="/" hash="top" className="nav-brand" onClick={(event) => goHash(event, "top")}>
          <BrandLogo size="nav" />
          <span>
            <strong>{SITE.shortName}</strong>
          </span>
        </Link>

        <nav className="nav-links" aria-label="بخش‌های صفحه">
          {NAV.map((item) => {
            const isFinance = item.id === "tools";
            const isFinanceCurrent = pathname.startsWith("/tools/");
            if (isFinance) {
              return (
                <div key={item.id} className="nav-tools-menu">
                  <Link
                    to="/tools"
                    className={cn("nav-tools-trigger", isFinanceCurrent && "is-current")}
                    aria-haspopup="true"
                    aria-expanded={isFinanceCurrent ? "true" : undefined}
                    onClick={closeMenu}
                  >
                    {item.label}
                    <span className="nav-tools-caret" aria-hidden="true">⌄</span>
                  </Link>
                  <div className="nav-tools-dropdown" role="menu" aria-label="ابزارهای مالی">
                    <div className="nav-tools-dropdown-head">
                      <span>محاسبه‌گرهای هیرمند</span>
                      <small>انتخاب کنید تا وارد صفحه اختصاصی شوید</small>
                    </div>
                    <div className="nav-tools-dropdown-grid">
                      {FINANCE_NAV.map((tool) => {
                        const Icon = tool.icon;
                        return (
                          <Link
                            key={tool.id}
                            to={tool.href}
                            role="menuitem"
                            className={cn("nav-tool-item", pathname === tool.href && "is-active")}
                            onClick={closeMenu}
                          >
                            <span className="nav-tool-item-icon" aria-hidden="true">
                              <Icon size={18} strokeWidth={1.9} />
                            </span>
                            <span className="nav-tool-item-copy">
                              <strong>{tool.label}</strong>
                              <small>{tool.text}</small>
                            </span>
                            <span className="nav-tool-item-arrow" aria-hidden="true">←</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            return item.to === "/" ? (
              <Link key={item.id} to="/" hash={item.hash} onClick={(event) => goHash(event, item.hash)}>
                {item.label}
              </Link>
            ) : (
              <Link
                key={item.id}
                to={item.to}
                className={cn(pathname === item.to && "is-current")}
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="nav-actions">
          <Link
            to="/"
            hash="inquiry"
            className="header-inquiry"
            onClick={(event) => {
              if (onHome) scrollToId(event, "inquiry", closeMenu);
              else closeMenu();
            }}
          >
            درخواست ملک
          </Link>
          <CallMenu className="nav-call-menu" buttonClassName="nav-call" align="end" />
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <div
        className={cn("mobile-menu", menuOpen && "is-open")}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        {NAV.map((item) => {
          if (item.id === "tools") {
            return (
              <div key={item.id} className={cn("mobile-tools-group", financeOpen && "is-open")}>
                <button
                  type="button"
                  className="mobile-tools-trigger"
                  aria-expanded={financeOpen}
                  aria-controls="mobile-finance-tools"
                  onClick={() => setFinanceOpen((value) => !value)}
                >
                  <span>{item.label}</span>
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className="mobile-tools-trigger-icon"
                  />
                </button>
                <div
                  id="mobile-finance-tools"
                  className="mobile-tools-list"
                  aria-label="ابزارهای مالی"
                  aria-hidden={!financeOpen}
                >
                  <Link to="/tools" className="mobile-tool-item mobile-tool-item-all" onClick={closeMenu}>
                    <span className="mobile-tool-item-icon" aria-hidden="true">
                      <WalletCards size={17} strokeWidth={1.9} />
                    </span>
                    <span>
                      <strong>همه ابزارهای مالی</strong>
                      <small>مشاهده صفحه اصلی ابزارها</small>
                    </span>
                  </Link>
                  {FINANCE_NAV.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <Link
                        key={tool.id}
                        to={tool.href}
                        className={cn("mobile-tool-item", pathname === tool.href && "is-active")}
                        onClick={closeMenu}
                      >
                        <span className="mobile-tool-item-icon" aria-hidden="true">
                          <Icon size={17} strokeWidth={1.9} />
                        </span>
                        <span>
                          <strong>{tool.label}</strong>
                          <small>{tool.text}</small>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          return item.to === "/" ? (
            <Link key={item.id} to="/" hash={item.hash} onClick={(event) => goHash(event, item.hash)}>
              {item.label}
            </Link>
          ) : (
            <Link key={item.id} to={item.to} onClick={closeMenu}>
              {item.label}
            </Link>
          );
        })}
        <Link
          to="/"
          hash="inquiry"
          className="mobile-menu-inquiry"
          onClick={(event) => {
            if (onHome) scrollToId(event, "inquiry", closeMenu);
            else closeMenu();
          }}
        >
          درخواست ملک
        </Link>
        <div className="mobile-call-list">
          {TEAM.map((person) => (
            <a key={person.id} className="mobile-call" href={`tel:${person.phone}`} onClick={closeMenu}>
              تماس با {person.name}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
