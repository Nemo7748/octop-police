import { useEffect, useState } from "react";
import { Badge, Layout } from "antd";
import { Bell, Menu as MenuIcon, Github, Settings, Shield } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PwaInstallPrompt from "../components/PwaInstallPrompt";
import pwaStyles from "../components/PwaInstallPrompt/index.module.less";
import AppVersionBadge from "../components/AppVersionBadge";
import BetaBadge from "../components/BetaBadge";
import CurrentVersionBadge from "../components/CurrentVersionBadge";
import ThemeSwitcher from "../components/ThemeSwitcher";
import AvatarDropdown from "../components/AvatarDropdown";
import { authApi } from "../api/modules/auth";
import type { OctopUser } from "../api/modules/auth";
import { useTheme } from "../context/ThemeContext";
import { useAgent } from "../context/AgentContext";
import { useUserRole } from "../hooks/useUserRole";
import { usePoliceNavigation } from "../hooks/usePoliceNavigation";
import { typeSize } from "../utils/mobileTypeScale";

const { Header: AntHeader } = Layout;

interface HeaderProps {
  selectedKey?: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
  isMobile?: boolean;
  isPoliceRoute?: boolean;
}

export default function Header({
  onToggle,
  isMobile,
  isPoliceRoute: policeRouteProp,
}: HeaderProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();
  const navigation = usePoliceNavigation();
  const role = useUserRole();
  const { agents } = useAgent();
  const [user, setUser] = useState<OctopUser | null>(null);
  const isPoliceWorkbench =
    policeRouteProp ??
    (location.pathname === "/chat" || location.pathname.startsWith("/chat/"));
  const unreadTotal = agents.reduce(
    (sum, agent) => sum + (agent.unread_count ?? 0),
    0,
  );

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => {});
  }, []);

  const logoSrc = isDark ? "/logo_name_dark.png" : "/logo_name.png";

  return (
    <AntHeader
      style={{
        height: "var(--fn-header-height)",
        padding: isMobile ? "0 12px" : "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "var(--fn-header-bg)",
        backdropFilter: "blur(var(--fn-header-blur))",
        WebkitBackdropFilter: "blur(var(--fn-header-blur))",
        borderBottom: "1px solid var(--fn-border-primary)",
        transition: "background var(--fn-transition)",
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Left: mobile toggle + logo */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
      >
        {isMobile && onToggle && (
          <button
            onClick={onToggle}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: typeSize(34, isMobile),
              height: typeSize(34, isMobile),
              border: "none",
              borderRadius: "var(--fn-radius-md)",
              background: "transparent",
              color: "var(--fn-text-tertiary)",
              cursor: "pointer",
              transition: "all var(--fn-transition-fast)",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--fn-bg-tertiary)";
              e.currentTarget.style.color = "var(--fn-text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--fn-text-tertiary)";
            }}
          >
            <MenuIcon size={20} strokeWidth={1.8} />
          </button>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            flexShrink: 1,
          }}
        >
          {isPoliceWorkbench ? (
            <div
              data-testid="police-brand"
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <Shield size={26} strokeWidth={1.8} aria-hidden />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong style={{ fontSize: 16, lineHeight: 1.2 }}>
                  {t("policeWorkbench.brand.name")}
                </strong>
                {!isMobile && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--fn-text-secondary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {t("policeWorkbench.brand.subtitle")}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              <img
                src={logoSrc}
                alt="octop"
                style={{
                  height: isMobile ? 36 : 42,
                  width: "auto",
                  maxWidth: isMobile ? 230 : 280,
                  objectFit: "contain",
                  flexShrink: 0,
                  display: "block",
                }}
              />
              <BetaBadge isMobile={isMobile} />
              <CurrentVersionBadge isMobile={isMobile} />
              <AppVersionBadge isMobile={isMobile} />
            </>
          )}
        </div>
      </div>

      {/* Right: GitHub + PWA install + avatar dropdown */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 4 : 10,
          flexShrink: 0,
        }}
      >
        {isPoliceWorkbench && (
          <>
            <button
              type="button"
              aria-label={t("policeWorkbench.nav.messages")}
              title={t("policeWorkbench.nav.messages")}
              onClick={() =>
                navigation.navigate({
                  sourceEntry: "header.messages",
                  capabilityId: "messages",
                })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                border: "none",
                borderRadius: "var(--fn-radius-md)",
                background: "transparent",
                color: "var(--fn-text-secondary)",
                cursor: "pointer",
              }}
            >
              <Badge count={unreadTotal} size="small" overflowCount={99}>
                <Bell size={18} strokeWidth={1.8} />
              </Badge>
            </button>
            {role === "admin" && (
              <button
                type="button"
                aria-label={t("policeWorkbench.nav.settings")}
                title={t("policeWorkbench.nav.settings")}
                onClick={() =>
                  navigation.navigate({
                    sourceEntry: "header.settings",
                    capabilityId: "settings",
                  })
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  border: "none",
                  borderRadius: "var(--fn-radius-md)",
                  background: "transparent",
                  color: "var(--fn-text-secondary)",
                  cursor: "pointer",
                }}
              >
                <Settings size={18} strokeWidth={1.8} />
              </button>
            )}
          </>
        )}
        {!isMobile && !isPoliceWorkbench && (
          <a
            href="https://github.com/TencentCloud/Octop"
            target="_blank"
            rel="noopener noreferrer"
            className={pwaStyles.installBtn}
          >
            <Github
              size={16}
              strokeWidth={1.8}
              className={pwaStyles.installIcon}
            />
            <span className={pwaStyles.label}>GitHub</span>
          </a>
        )}
        <PwaInstallPrompt compact={isMobile} />
        {!isMobile && <ThemeSwitcher compact />}
        <AvatarDropdown user={user} onUserChange={setUser} />
      </div>
    </AntHeader>
  );
}
