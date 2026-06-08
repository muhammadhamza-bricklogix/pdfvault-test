import type {
  AuditListParams,
  AuditListResponse,
} from "@/lib/shared/types/audit.types";

import { apiClient } from "@/lib/config/api-client";
import { AUDIT } from "@/lib/shared/constants/endpoints";
import { ApiError } from "@/lib/shared/utils/api-error";

function emptyResponse(params: AuditListParams): AuditListResponse {
  return {
    items: [],
    pagination: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
      total: 0,
      totalPages: 0,
    },
  };
}

// The backend doesn't yet expose a read API for audit events (events are only
// emitted to structured logs). Until that ships, treat 404 as "no activity"
// instead of letting React Query surface a loud error to the user.
function isMissingAuditEndpoint(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}

async function listAuditEvents(
  params: AuditListParams = {},
): Promise<AuditListResponse> {
  try {
    const { data } = await apiClient.get<AuditListResponse>(AUDIT.LIST, {
      params,
    });

    return data;
  } catch (error) {
    if (isMissingAuditEndpoint(error)) {
      return emptyResponse(params);
    }

    throw error;
  }
}

async function listDocumentAuditEvents(
  documentId: string,
  params: AuditListParams = {},
): Promise<AuditListResponse> {
  try {
    const { data } = await apiClient.get<AuditListResponse>(
      AUDIT.BY_DOCUMENT(documentId),
      { params },
    );

    return data;
  } catch (error) {
    if (isMissingAuditEndpoint(error)) {
      return emptyResponse(params);
    }

    throw error;
  }
}

export const auditService = {
  listAuditEvents,
  listDocumentAuditEvents,
};
