import { initializeArc } from "arc";
import Loading from "components/Shared/Loading";
import AppContainer from "layouts/AppContainer";
import { sleep } from "lib/util";
import ErrorUncaught from "components/Errors/ErrorUncaught";
import * as React from "react";
import { Provider } from "react-redux";
import { HashRouter, Route, Switch, Redirect } from "react-router-dom";
import { ThroughProvider } from "react-through";
import * as css from "./layouts/App.scss";
import { default as store } from "./configureStore";

export class App extends React.Component<{}, {
  arcIsInitialized: boolean;
  retryingArc: boolean;
  error?: string;
}> {
  constructor(props: {}) {
    super(props);
    this.state = {
      arcIsInitialized: false,
      retryingArc: false,
      error: undefined,
    };
  }


  public async componentDidMount (): Promise<void> {
    // Do this here because we need to have initialized Arc first.  This will
    // not create a provider for the app, rather will just initialize Arc with a
    // readonly provider with no account, internal only to it.
    const totalNumberOfAttempts = 3; /// we will try 3 times to init arc before actually throwing an error
    let numberOfAttempts = 0;
    let success = false;
    const initArc = async () => {
      success = await initializeArc();
      if (!success) {
        throw Error("Initialize arc failed for an unknown reason (see the console)...");
      }
      this.setState({ arcIsInitialized: true });
    };
    while (!success) {
      try {
        await initArc();
      } catch (err) {
        this.setState({ retryingArc: true });
        // eslint-disable-next-line no-console
        numberOfAttempts += 1;
        // retry
        if (numberOfAttempts >= totalNumberOfAttempts) {
          const msg = "Could not connect to the network; please retry later...";
          this.setState({ error: msg});
          throw Error(msg);
        }
        // eslint-disable-next-line no-console
        console.error("Could not connect..");
        // eslint-disable-next-line no-console
        console.error(err);
        // eslint-disable-next-line no-console
        console.log(`retrying (attempt ${numberOfAttempts} of ${totalNumberOfAttempts})`);
        await sleep(2000);
      }
    }

  }

  public render(): RenderOutput {
    if (this.state.error) {
      return <ErrorUncaught errorMessage={this.state.error} />;

    }
    if (!this.state.arcIsInitialized) {
      return (
        <div className={css.waitingToInitContainer}>
          { this.state.retryingArc ?
            <div className={css.waitingToInitMessage}>Waiting to connect to the blockchain.  If this is taking a while, please ensure that you have a good internet connection.</div> : ""
          }
          <Loading/>
        </div>
      );
    } else {
      return (
        <Provider store={store}>
          <ThroughProvider>
            <HashRouter>
              <Switch>
                <Route path="/dao" component={AppContainer}/>
                <Route path="/profile" component={AppContainer}/>
                <Redirect from="/" to="/dao" />
              </Switch>
            </HashRouter>
          </ThroughProvider>
        </Provider>
      );
    }
  }
}
