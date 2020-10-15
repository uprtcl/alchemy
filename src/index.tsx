import { init as sentryInit } from "@sentry/browser";
import * as Mixpanel from "mixpanel-browser";
import * as React from "react";
import { render } from "react-dom";
import { AppContainer } from "react-hot-loader";
import "./i18n";

import UprtclOrchestrator from "./UprtclOrchestrator";
import { App } from "./App";

import "./assets/styles/global.scss";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

/** The UprtclOrchestrator register the web-components of the _Prtcl Wiki
 *  and prepares the services needed by the _Prtcl infrastructure */
export const uprtcl = UprtclOrchestrator.getInstance();

async function renderApp() {

  if (process.env.NODE_ENV === "production") {
    sentryInit({
      dsn: "https://748c6f9811fe407ca2853b64bf638690@sentry.io/1419793",
      environment: process.env.NODE_ENV,
    });
  }

  if (process.env.MIXPANEL_TOKEN && (process.env.NODE_ENV === "production")) {
    Mixpanel.init(process.env.MIXPANEL_TOKEN);
  }

  await uprtcl.load();

  render(
    <AppContainer>
      <App />
    </AppContainer>,
    document.querySelector("#root"),
  );
}

if (module.hot) {
  module.hot.accept();
  renderApp();
} else {
  renderApp();
}
