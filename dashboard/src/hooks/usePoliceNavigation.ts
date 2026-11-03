import { useCallback, useMemo } from "react";
import { message } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAgent } from "../context/AgentContext";
import { beginNavigationIntent } from "../utils/navigationIntent";
import { readWorkbenchReturn } from "../utils/workbenchReturnStore";
import { workbenchDiagnostics } from "../utils/workbenchDiagnostics";
import {
  getPoliceCapability,
  isPoliceWorkbenchPath,
  resolvePoliceCapability,
  type PoliceCapabilityId,
  type PoliceNavigationController,
  type PoliceNavigationRequest,
  type PoliceNavigationResult,
  type WorkbenchIntent,
} from "../routes/policeCapabilities";
import { useUserRole } from "./useUserRole";

const DEFAULT_INTENTS: Partial<Record<PoliceCapabilityId, WorkbenchIntent>> = {
  "new-task": "new-task",
  projects: "projects",
  library: "library",
  "web-workbench": "focus-composer",
};

function routeChatContext(pathname: string): {
  readonly agentId: string | null;
  readonly threadId: string | null;
} {
  const match = /^\/chat(?:\/([^/]+))?(?:\/([^/]+))?\/?$/.exec(pathname);
  return {
    agentId: match?.[1] ?? null,
    threadId: match?.[2] ?? null,
  };
}

export function usePoliceNavigation(): PoliceNavigationController {
  const routerNavigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const role = useUserRole();
  const { activeAgentId } = useAgent();

  const navigate = useCallback(
    (request: PoliceNavigationRequest): PoliceNavigationResult => {
      const capability = getPoliceCapability(request.capabilityId);
      if (!capability?.available) {
        workbenchDiagnostics.navigation({
          sourceEntry: request.sourceEntry,
          capabilityId: request.capabilityId,
          result: "unavailable",
        });
        void message.error(t("policeWorkbench.navigation.capabilityUnavailable"));
        return { status: "unavailable" };
      }
      if (capability.requiredRole === "admin" && role !== "admin") {
        workbenchDiagnostics.navigation({
          sourceEntry: request.sourceEntry,
          capabilityId: request.capabilityId,
          result: "forbidden",
        });
        void message.error(t("policeWorkbench.navigation.forbidden"));
        return { status: "forbidden" };
      }

      const routeContext = routeChatContext(location.pathname);
      const currentAgentId = routeContext.agentId ?? activeAgentId;
      if (
        capability.contextRequirement !== "none" &&
        (!currentAgentId ||
          (capability.contextRequirement === "task" &&
            !routeContext.threadId))
      ) {
        workbenchDiagnostics.navigation({
          sourceEntry: request.sourceEntry,
          capabilityId: request.capabilityId,
          result: "context-required",
        });
        void message.warning(t("policeWorkbench.navigation.contextRequired"));
        return { status: "context-required" };
      }

      const intent = request.intent ?? DEFAULT_INTENTS[request.capabilityId];
      let targetPath = capability.path;
      if (capability.layout === "workbench") {
        const storedReturn = readWorkbenchReturn();
        const onWorkbench = isPoliceWorkbenchPath(location.pathname);
        if (intent === "new-task" && currentAgentId) {
          targetPath = `/chat/${currentAgentId}`;
        } else if (
          (request.capabilityId === "assistants" ||
            request.capabilityId === "messages") &&
          !onWorkbench &&
          storedReturn
        ) {
          targetPath = storedReturn.path;
        } else if (onWorkbench && routeContext.agentId) {
          targetPath = routeContext.threadId
            ? `/chat/${routeContext.agentId}/${routeContext.threadId}`
            : `/chat/${routeContext.agentId}`;
        } else if (
          storedReturn &&
          (!currentAgentId || storedReturn.context.agentId === currentAgentId)
        ) {
          targetPath = storedReturn.path;
        } else if (currentAgentId) {
          targetPath = `/chat/${currentAgentId}`;
        }
      }

      beginNavigationIntent();
      routerNavigate(targetPath, {
        state: intent ? { workbenchIntent: intent } : undefined,
      });
      workbenchDiagnostics.navigation({
        sourceEntry: request.sourceEntry,
        capabilityId: request.capabilityId,
        result: "navigated",
      });
      return { status: "navigated", path: targetPath };
    },
    [activeAgentId, location.pathname, role, routerNavigate, t],
  );

  return useMemo(
    () => ({ navigate, resolvePath: resolvePoliceCapability }),
    [navigate],
  );
}