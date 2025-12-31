import type { OutgoingMessage } from "./types";

// VS Code injects this function in webviews
declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void;
};

export const vscodeApi = acquireVsCodeApi();

export function postMessage(message: OutgoingMessage): void {
  vscodeApi.postMessage(message);
}
