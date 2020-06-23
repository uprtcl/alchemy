import * as uiActions from "actions/uiActions";
import { threeBoxLogout } from "actions/profilesActions";
import { setCurrentAccount } from "actions/web3Actions";
import AccountProfilePage from "components/Account/AccountProfilePage";
import Notification, { NotificationViewStatus } from "components/Notification/Notification";
import DaoContainer from "components/Dao/DaoContainer";
import Header from "layouts/Header";
import { IRootState } from "reducers";
import { dismissNotification, INotificationsState, NotificationStatus, showNotification, INotification } from "reducers/notifications";
import { getCachedAccount, cacheWeb3Info, logout, pollForAccountChanges } from "arc";
import ErrorUncaught from "components/Errors/ErrorUncaught";
import * as React from "react";

import { connect } from "react-redux";
import { Route, RouteComponentProps, Switch } from "react-router-dom";
import { ModalContainer } from "react-router-modal";
import { History } from "history";
import classNames from "classnames";
import { captureException, withScope } from "@sentry/browser";
import { Address } from "@daostack/arc.js";
import { sortedNotifications } from "../selectors/notifications";
import * as css from "./App.scss";
import SimpleMessagePopup, { ISimpleMessagePopupProps } from "components/Shared/SimpleMessagePopup";
import { initializeUtils } from "lib/util";

interface IExternalProps extends RouteComponentProps<any> {
  history: History;
}

interface IStateProps {
  currentAccountAddress: string;
  daoAvatarAddress: string;
  simpleMessageOpen: boolean;
  sortedNotifications: INotificationsState;
  threeBox: any;
}

const mapStateToProps = (state: IRootState, ownProps: IExternalProps): IStateProps & IExternalProps => {
  return {
    ...ownProps,
    currentAccountAddress: state.web3.currentAccountAddress,
    daoAvatarAddress: process.env.DAO_AVATAR_ADDRESS,
    simpleMessageOpen: state.ui.simpleMessageOpen,
    sortedNotifications: sortedNotifications()(state),
    threeBox: state.profiles.threeBox,
  };
};

interface IDispatchProps {
  dismissNotification: typeof dismissNotification;
  setCurrentAccount: typeof setCurrentAccount;
  showNotification: typeof showNotification;
  threeBoxLogout: typeof threeBoxLogout;
  showSimpleMessage: typeof uiActions.showSimpleMessage;
}

const mapDispatchToProps = {
  dismissNotification,
  setCurrentAccount,
  showNotification,
  threeBoxLogout,
  showSimpleMessage: uiActions.showSimpleMessage,
};

type IProps = IExternalProps & IStateProps & IDispatchProps;

interface IState {
  error: Error;
  sentryEventId: string;
}

class AppContainer extends React.Component<IProps, IState> {
  public unlisten: any;

  constructor(props: IProps) {
    super(props);
    this.state = {
      error: null,
      sentryEventId: null,
    };
  }

  private showSimpleMessage = (options: ISimpleMessagePopupProps): void => {
    this.props.showSimpleMessage(options);
  }

  public componentDidCatch(error: Error, errorInfo: any): void {
    this.setState({ error });

    if (process.env.NODE_ENV === "production") {
      withScope((scope): void => {
        scope.setExtras(errorInfo);
        const sentryEventId = captureException(error);
        this.setState({ sentryEventId });
      });
    }
  }

  public async componentDidMount (): Promise<void> {

    /**
     * Heads up that there is a chance this cached account may differ from an account
     * that the user has already selected in a provider but have
     * not yet made available to the app.
     */
    const currentAddress = getCachedAccount();
    let accountWasCached = false;
    if (currentAddress) {
      accountWasCached = true;
      // eslint-disable-next-line no-console
      console.log(`using account from local storage: ${currentAddress}`);
    }

    this.props.setCurrentAccount(currentAddress);

    initializeUtils({ showSimpleMessage: this.showSimpleMessage });

    /**
     * Only supply currentAddress if it was obtained from a provider.  The poll
     * is only comparing changes with respect to the provider state.  Passing it a cached state
     * will only cause it to get the wrong impression and misbehave.
     */
    pollForAccountChanges(accountWasCached ? null : currentAddress).subscribe(
      (newAddress: Address | null): void => {
        // eslint-disable-next-line no-console
        console.log(`new account: ${newAddress}`);
        this.props.setCurrentAccount(newAddress);
        if (newAddress) {
          cacheWeb3Info(newAddress);
        } else {
          logout(this.props.showNotification);

          // TODO: save the threebox for each profile separately so we dont have to logout here
          this.props.threeBoxLogout();
        }
      });

    /**
     * display checking the subgraph.  It is falsely reporting that the subgraph is down.
    pollSubgraphUpdating().subscribe(async (subgraphRunning: boolean) => {
      if (!subgraphRunning) {
        this.props.showNotification(NotificationStatus.Failure, "The subgraph is no longer updating, please refresh the page to see the latest data");
      }
    });
     */
  }

  private clearError = () => {
    this.setState({ error: null, sentryEventId: null });
  }

  private dismissNotif = (id: string) => () => this.props.dismissNotification(id);
  private headerHtml = ( props: any ): any => <Header {...props} />;

  private notificationHtml = (notif: INotification): any => {
    return <div key={notif.id}>
      <Notification
        title={(notif.title || notif.status).toUpperCase()}
        status={
          notif.status === NotificationStatus.Failure ?
            NotificationViewStatus.Failure :
            notif.status === NotificationStatus.Success ?
              NotificationViewStatus.Success :
              NotificationViewStatus.Pending
        }
        message={notif.message}
        fullErrorMessage={notif.fullErrorMessage}
        url={notif.url}
        timestamp={notif.timestamp}
        dismiss={this.dismissNotif(notif.id)}
        showNotification={this.props.showNotification}
      />
    </div>;
  }

  public componentWillUnmount() {
    this.unlisten();
  }

  public render(): RenderOutput {

    const {
      sortedNotifications,
    } = this.props;

    if (this.state.error) {
      // Render error fallback UI
      // eslint-disable-next-line no-console
      console.error(this.state.error);
      return <div>
        <ErrorUncaught errorMessage={this.state.error.message} sentryEventId={this.state.sentryEventId} goHome={this.clearError}></ErrorUncaught>
      </div>;
    } else {

      return (
        <div className={classNames({[css.outer]: true, [css.withDAO]: false})}>

          <div className={css.container}>
            <Route path="/" render={this.headerHtml} />

            <div className={css.contentWrapper}>
              <Switch>
                <Route path="/dao" component={DaoContainer} />
                <Route path="/profile/:accountAddress" component={AccountProfilePage} />
                <Route path="/" component={DaoContainer} />
              </Switch>
            </div>

            <ModalContainer
              backdropClassName={css.backdrop}
              containerClassName={css.modalContainer}
              bodyModalClassName={css.modalBody}
            />

            <SimpleMessagePopup />
          </div>

          <div className={css.pendingTransactions}>
            {sortedNotifications.map(this.notificationHtml)}
          </div>
          <div className={css.background}></div>
        </div>
      );
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(AppContainer);
