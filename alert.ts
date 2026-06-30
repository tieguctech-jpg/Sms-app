import { Alert as RNAlert, Platform } from "react-native";

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export interface AlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: AlertButtonStyle;
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export type AlertPromptType =
  | "default"
  | "plain-text"
  | "secure-text"
  | "login-password";

export interface AlertRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
  isPrompt: boolean;
  promptType?: AlertPromptType;
  defaultValue?: string;
}

/**
 * The in-app dialog host (mounted once at the root) registers a handler here.
 * React Native's Alert is a no-op on react-native-web, so on web we route
 * every alert/prompt through an in-app <AlertHost /> modal that renders ALL
 * provided buttons and invokes exactly the tapped button's callback. Native
 * keeps using the platform Alert, which already works correctly.
 */
type AlertHandler = (req: AlertRequest) => void;
let handler: AlertHandler | null = null;

export function registerAlertHandler(h: AlertHandler | null): void {
  handler = h;
}

function defaultButtons(buttons?: AlertButton[]): AlertButton[] {
  if (buttons && buttons.length > 0) return buttons;
  return [{ text: "OK", style: "default" }];
}

/**
 * Last-resort web fallback used only if the in-app host is not mounted yet.
 * Collapses to window.alert/confirm/prompt. Less faithful than the modal, but
 * better than silently doing nothing.
 */
function webFallback(req: AlertRequest): void {
  if (typeof window === "undefined") return;
  const body = req.message ? `${req.title}\n\n${req.message}` : req.title;
  const buttons = req.buttons;
  const cancelBtn = buttons.find((b) => b.style === "cancel");
  const confirmBtn =
    buttons.find((b) => b.style !== "cancel") ?? buttons[buttons.length - 1];

  if (req.isPrompt) {
    const value = window.prompt(body, req.defaultValue ?? "");
    if (value === null) cancelBtn?.onPress?.();
    else confirmBtn?.onPress?.(value);
    return;
  }

  if (buttons.length <= 1) {
    window.alert(body);
    buttons[0]?.onPress?.();
    return;
  }

  const ok = window.confirm(body);
  if (ok) confirmBtn?.onPress?.();
  else cancelBtn?.onPress?.();
}

function dispatch(req: AlertRequest): void {
  if (handler) handler(req);
  else webFallback(req);
}

function alert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
): void {
  if (Platform.OS !== "web") {
    RNAlert.alert(title, message, buttons, options);
    return;
  }
  dispatch({
    title,
    message,
    buttons: defaultButtons(buttons),
    isPrompt: false,
  });
}

function prompt(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  type?: AlertPromptType,
  defaultValue?: string,
): void {
  // iOS has a real native prompt; use it.
  if (Platform.OS === "ios") {
    RNAlert.prompt(title, message, buttons, type, defaultValue);
    return;
  }
  // Web and Android (which has no native prompt) use the in-app modal.
  dispatch({
    title,
    message,
    buttons: defaultButtons(buttons),
    isPrompt: true,
    promptType: type,
    defaultValue,
  });
}

export const Alert = { alert, prompt };
