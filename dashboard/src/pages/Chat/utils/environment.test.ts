import { describe, expect, it } from "vitest";
import { isLoopbackHostname, resolveDeploymentKind } from "./environment";

describe("environment 部署类型判定", () => {
  it("回环地址可标识本机", () => {
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("LOCALHOST")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
    expect(isLoopbackHostname("127.0.1.2")).toBe(true);
    expect(isLoopbackHostname("::1")).toBe(true);
    expect(isLoopbackHostname("[::1]")).toBe(true);
    expect(isLoopbackHostname("app.localhost")).toBe(true);
  });

  it("非回环地址不得推断为本机或云上", () => {
    expect(isLoopbackHostname("example.com")).toBe(false);
    expect(isLoopbackHostname("192.168.1.10")).toBe(false);
    expect(isLoopbackHostname("10.0.0.8")).toBe(false);
    expect(isLoopbackHostname("128.0.0.1")).toBe(false);
    expect(isLoopbackHostname("127.999.0.1")).toBe(false);
    expect(isLoopbackHostname("")).toBe(false);
    expect(resolveDeploymentKind("example.com")).toBe("unknown");
    expect(resolveDeploymentKind("127.0.0.1")).toBe("local");
  });
});
