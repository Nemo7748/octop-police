import { Spin } from "antd";
import PoliceRouteBoundary from "./PoliceRouteBoundary";
import { useUserRole } from "../hooks/useUserRole";

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps admin-only routes and keeps permission feedback on the target route.
 * Shows a full-screen spinner while the role is loading.
 */
export default function RequireAdmin({ children }: Props) {
  const role = useUserRole();

  if (role === null) {
    // Loading — show spinner.
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (role !== "admin") {
    return <PoliceRouteBoundary status="forbidden" />;
  }

  return <>{children}</>;
}
