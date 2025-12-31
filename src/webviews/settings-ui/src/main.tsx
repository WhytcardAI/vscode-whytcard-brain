import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import type { SettingsState } from "./types";

function readInitialState(): SettingsState {
  const root = document.getElementById("root");
  const raw = root?.getAttribute("data-initial-state") ?? "";
  if (!raw) {
    throw new Error("Missing initial state");
  }
  return JSON.parse(raw) as SettingsState;
}

const state = readInitialState();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App initialState={state} />
  </React.StrictMode>,
);
