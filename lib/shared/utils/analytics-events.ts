/**
 * Canonical Sentry / analytics event names.
 *
 * Emitted via `logger.event(EVENTS.X, level, data)`. Centralised so
 * typos surface at compile time and grep for "who fires X" is one hop.
 *
 * Naming: `<feature>.<verb>[_<qualifier>]`. Feature prefixes:
 *   auth     — signin/signup/2fa flows
 *   export   — PDF/format export from editor
 *   paywall  — modal open/cancel/success
 *   checkout — Solidgate iframe + backend sync
 *   upload   — file drop → cloud save
 *   save     — editor save-to-library
 *   document — editor document loader
 *   hydrator — PendingEditorFileHydrator lifecycle
 *   signin_prompt — SignInPromptModal
 */
export const EVENTS = {
  SIGNIN_OAUTH_START: "signin.oauth_start",
  SIGNIN_OAUTH_ERROR: "signin.oauth_error",
  SIGNIN_CREDENTIALS_START: "signin.credentials_start",
  SIGNIN_CREDENTIALS_COMPLETE: "signin.credentials_complete",
  SIGNIN_CREDENTIALS_ERROR: "signin.credentials_error",
  SIGNIN_NEEDS_2FA: "signin.needs_2fa",
  SIGNIN_CODE_VERIFY_START: "signin.code_verify_start",
  SIGNIN_2FA_COMPLETE: "signin.2fa_complete",
  SIGNIN_CODE_VERIFY_ERROR: "signin.code_verify_error",
  SIGNIN_FINALIZE_START: "signin.finalize_start",
  SIGNIN_FINALIZE_OK: "signin.finalize_ok",
  SIGNIN_FINALIZE_ERROR: "signin.finalize_error",
  SIGNIN_CODE_SENT: "signin.code_sent",
  SIGNIN_MODE_SWITCHED: "signin.mode_switched",

  SIGNUP_START: "signup.start",
  SIGNUP_OAUTH_START: "signup.oauth_start",
  SIGNUP_OAUTH_ERROR: "signup.oauth_error",
  SIGNUP_CREDENTIALS_ERROR: "signup.credentials_error",
  SIGNUP_CODE_SENT: "signup.code_sent",
  SIGNUP_VERIFY_COMPLETE: "signup.verify_complete",
  SIGNUP_VERIFY_ERROR: "signup.verify_error",
  SIGNUP_FINALIZE_START: "signup.finalize_start",
  SIGNUP_FINALIZE_OK: "signup.finalize_ok",
  SIGNUP_FINALIZE_ERROR: "signup.finalize_error",
  SIGNUP_MODE_SWITCHED: "signup.mode_switched",

  AUTH_QUICK_SIGNUP_BEGIN: "auth.quick_signup.begin",
  AUTH_QUICK_SIGNUP_BACKEND_OK: "auth.quick_signup.backend_ok",
  AUTH_QUICK_SIGNUP_BACKEND_EXISTS: "auth.quick_signup.backend_exists",
  AUTH_QUICK_SIGNUP_BACKEND_ERROR: "auth.quick_signup.backend_error",
  AUTH_QUICK_SIGNUP_TICKET_OK: "auth.quick_signup.ticket_ok",
  AUTH_QUICK_SIGNUP_TICKET_ERROR: "auth.quick_signup.ticket_error",
  AUTH_QUICK_SIGNUP_UPLOAD_OK: "auth.quick_signup.upload_ok",
  AUTH_QUICK_SIGNUP_UPLOAD_ERROR: "auth.quick_signup.upload_error",
  AUTH_QUICK_SIGNUP_NOTIFY_OK: "auth.quick_signup.notify_ok",
  AUTH_QUICK_SIGNUP_NOTIFY_ERROR: "auth.quick_signup.notify_error",
  AUTH_QUICK_SIGNUP_FINALIZE_OK: "auth.quick_signup.finalize_ok",
  AUTH_QUICK_SIGNUP_FINALIZE_ERROR: "auth.quick_signup.finalize_error",

  SIGNIN_PROMPT_DISPATCHED: "signin_prompt.dispatched",
  SIGNIN_PROMPT_CANCELLED: "signin_prompt.cancelled",
  SIGNIN_PROMPT_CONFIRMED: "signin_prompt.confirmed",

  EXPORT_START: "export.start",
  EXPORT_NO_FILE: "export.no_file",
  EXPORT_SIGNIN_REQUIRED: "export.signin_required",
  EXPORT_PAYWALL_SHOWN: "export.paywall_shown",
  EXPORT_PAYWALL_CANCELLED: "export.paywall_cancelled",
  EXPORT_PAYWALL_SUCCESS: "export.paywall_success",
  EXPORT_CONVERT_CANCELLED: "export.convert_cancelled",
  EXPORT_SUCCESS: "export.success",

  PAYWALL_OPENED: "paywall.opened",
  PAYWALL_MODAL_MOUNT: "paywall.modal_mount",
  PAYWALL_MODAL_CLOSED_MANUAL: "paywall.modal_closed_manual",
  PAYWALL_PLAN_SELECTED: "paywall.plan_selected",
  PAYWALL_PLAN_STEP_CONTINUE: "paywall.plan_step_continue",
  PAYWALL_PAY_STEP_MOUNTED: "paywall.pay_step_mounted",
  PAYWALL_RETRY_CANCELLED: "paywall.retry_cancelled",
  PAYWALL_RECEIPT_DOWNLOAD_OK: "paywall.receipt_download_ok",
  PAYWALL_RECEIPT_DOWNLOAD_ERROR: "paywall.receipt_download_error",
  PAYWALL_CANCELLED: "paywall.cancelled",
  PAYWALL_PAYMENT_SUCCESS: "paywall.payment_success",
  PAYWALL_PENDING_ACTION_OK: "paywall.pending_action_ok",
  PAYWALL_BUS_SIGNIN_PROMPT: "paywall.bus_signin_prompt",

  CHECKOUT_INTENT_START: "checkout.intent_start",
  CHECKOUT_INTENT_OK: "checkout.intent_ok",
  CHECKOUT_INTENT_ERROR: "checkout.intent_error",
  CHECKOUT_IFRAME_SUCCESS: "checkout.iframe_success",
  CHECKOUT_IFRAME_DECLINED: "checkout.iframe_declined",
  CHECKOUT_ENTITLEMENT_MISMATCH: "checkout.entitlement_mismatch",
  CHECKOUT_ENTITLEMENT_CONFIRMED: "checkout.entitlement_confirmed",
  CHECKOUT_RETRY_START: "checkout.retry_start",
  CHECKOUT_RETRY_INTENT_OK: "checkout.retry_intent_ok",

  UPLOAD_SIGNIN_REQUIRED: "upload.signin_required_on_convert",
  UPLOAD_PAYWALL_SHOWN: "upload.paywall_shown",
  UPLOAD_PAYWALL_CANCELLED: "upload.paywall_cancelled",
  UPLOAD_PAYWALL_SUCCESS: "upload.paywall_success",
  UPLOAD_DUPLICATE_DETECTED: "upload.duplicate_detected",
  UPLOAD_SAVE_BEFORE_OPEN_OK: "upload.save_before_open_ok",
  UPLOAD_OPEN_EDITOR: "upload.open_editor",

  SAVE_START: "save.start",
  SAVE_OK: "save.ok",
  SAVE_BLOCKED: "save.blocked",
  SAVE_BEFORE_ACTION_START: "save.before_action_start",
  SAVE_BEFORE_ACTION_OK: "save.before_action_ok",
  SAVE_BEFORE_ACTION_BLOCKED: "save.before_action_blocked",

  DOCUMENT_LOADER_SIGNIN_REQUIRED: "document_loader.signin_required",
  DOCUMENT_LOADER_LOAD_OK: "document_loader.load_ok",
  DOCUMENT_LOADER_AUTH_ERROR_BOUNCE: "document_loader.auth_error_bounce",
  DOCUMENT_LOADER_LOAD_FAIL_STAY_LOCAL: "document_loader.load_fail_stay_local",
  DOCUMENT_LOADER_LOAD_FAIL_BOUNCE_DASHBOARD:
    "document_loader.load_fail_bounce_dashboard",

  HYDRATOR_SIGNED_IN_REDIRECT_TO_PICKER:
    "hydrator.signed_in_redirect_to_picker",
  HYDRATOR_AUTH_GATED_REDIRECT_TO_SIGNIN:
    "hydrator.auth_gated_redirect_to_signin",
  HYDRATOR_POST_SIGNIN_RESTORE: "hydrator.post_signin_restore",
  HYDRATOR_POST_SIGNIN_RESTORE_OK: "hydrator.post_signin_restore_ok",
  HYDRATOR_BACKGROUND_AUTOSAVE_OK: "hydrator.background_autosave_ok",
  HYDRATOR_AUTO_LAUNCH: "hydrator.auto_launch",
} as const;

export type AppEventName = (typeof EVENTS)[keyof typeof EVENTS];
