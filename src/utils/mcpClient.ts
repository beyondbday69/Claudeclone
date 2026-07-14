import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

interface McpConnection {
  url: string;
  client: Client;
  tools: any[];
}

const connections = new Map<string, McpConnection>();

export async function connectMcp(url: string): Promise<{success: boolean, error?: string, tools?: any[]}> {
  if (connections.has(url)) {
      return { success: true, tools: connections.get(url)!.tools };
  }
  
  try {
    const transport = new SSEClientTransport(new URL(url), {
      eventSourceInit: {
        headers: {
          'X-Pinggy-No-Screen': 'true'
        }
      } as any,
      requestInit: {
        headers: {
          'X-Pinggy-No-Screen': 'true'
        }
      }
    });

    const client = new Client(
      { name: "browser-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);

    const toolsResponse = await client.listTools();
    const mcpTools = toolsResponse.tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.inputSchema
      }
    }));
    
    connections.set(url, { url, client, tools: mcpTools });

    return { success: true, tools: mcpTools };
  } catch (error: any) {
    console.error("MCP connection error details:", error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
}

export function getMcpTools() {
  const allTools: any[] = [];
  for (const conn of connections.values()) {
    allTools.push(...conn.tools);
  }
  return allTools;
}

export async function executeMcpTool(name: string, args: any) {
  for (const conn of connections.values()) {
    const hasTool = conn.tools.some(t => t.function.name === name);
    if (hasTool) {
      return await conn.client.callTool({
        name,
        arguments: args
      });
    }
  }
  throw new Error(`Tool ${name} not found in any connected MCP client`);
}

export function getConnectedMcpUrls() {
  return Array.from(connections.keys());
}

export function disconnectMcp(url: string) {
    connections.delete(url);
}
