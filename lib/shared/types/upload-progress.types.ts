export type UploadStage =
  | "queued"
  | "starting"
  | "received"
  | "validating"
  | "uploading_s3"
  | "saving_metadata"
  | "complete"
  | "error";

export type UploadProgressEvent = {
  trackingId: string;
  stage: UploadStage;
  /** 0-100 */
  progress: number;
  message: string;
};

/** Backend wraps payloads in a `data` envelope. */
export type UploadProgressEnvelope = {
  data: UploadProgressEvent;
};
