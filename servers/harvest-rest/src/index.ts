import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { readHarvestEnv } from "./env.js";
import { HarvestClient, type HarvestRequestInit } from "./harvest-client.js";
import { registerHarvestRestTools } from "./register-tools.js";
import { PACKAGE_VERSION } from "./version.js";

function createLazyClient(): HarvestClient {
  let inner: HarvestClient | undefined;
  const resolve = (): HarvestClient => {
    if (!inner) {
      const env = readHarvestEnv();
      inner = new HarvestClient({
        accessToken: env.accessToken,
        accountId: env.accountId,
        userAgent: env.userAgent,
        apiBase: env.apiBase,
      });
    }
    return inner;
  };

  return {
    request<T>(init: HarvestRequestInit): Promise<T> {
      return resolve().request<T>(init);
    },
  } as HarvestClient;
}

async function main(): Promise<void> {
  const server = new McpServer({
    name: "harvest-rest",
    version: PACKAGE_VERSION,
  });

  registerHarvestRestTools(server, createLazyClient());

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
