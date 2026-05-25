import type {
  AuditListParams,
  AuditListResponse,
} from "@/lib/shared/types/audit.types";

import { apiClient } from "@/lib/config/api-client";
import { AUDIT } from "@/lib/shared/constants/endpoints";

async function listAuditEvents(
  params: AuditListParams = {},
): Promise<AuditListResponse> {
  const { data } = await apiClient.get<AuditListResponse>(AUDIT.LIST, {
    params,
  });
  return data;
}

async function listDocumentAuditEvents(
  documentId: string,
  params: AuditListParams = {},
): Promise<AuditListResponse> {
  const { data } = await apiClient.get<AuditListResponse>(
    AUDIT.BY_DOCUMENT(documentId),
    { params },
  );
  return data;
}

export const auditService = {
  listAuditEvents,
  listDocumentAuditEvents,
};
