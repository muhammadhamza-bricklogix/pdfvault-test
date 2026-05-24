import type {
  Tool,
  ToolCategory,
  ToolsListResponse,
} from "@/lib/shared/types/tools.types";

import { apiClient } from "@/lib/config/api-client";
import { TOOLS } from "@/lib/shared/constants/endpoints";

async function listTools(category?: ToolCategory): Promise<ToolsListResponse> {
  const { data } = await apiClient.get<ToolsListResponse>(TOOLS.LIST, {
    params: category ? { category } : undefined,
  });

  return data;
}

async function getSuggestedTools(): Promise<Tool[]> {
  const { data } = await apiClient.get<Tool[]>(TOOLS.SUGGESTED);

  return data;
}

async function getTool(id: string): Promise<Tool> {
  const { data } = await apiClient.get<Tool>(TOOLS.DETAIL(id));

  return data;
}

export const toolsService = {
  listTools,
  getSuggestedTools,
  getTool,
};
