import { IDAOState, Member } from "@daostack/arc.js";
import { getProfilesForAddresses } from "actions/profilesActions";
import { getArc } from "arc";
import CreateProposalPage from "components/Proposal/Create/CreateProposalPage";
import ProposalDetailsPage from "components/Proposal/ProposalDetailsPage";
import PluginContainer from "components/Plugin/PluginContainer";
import Loading from "components/Shared/Loading";
import withSubscription, { ISubscriptionProps } from "components/Shared/withSubscription";
import * as React from "react";
import { BreadcrumbsItem } from "react-breadcrumbs-dynamic";
import { Helmet } from "react-helmet";
import { connect } from "react-redux";
import { Route, RouteComponentProps, Switch } from "react-router-dom";
//@ts-ignore
import { ModalRoute } from "react-router-modal";
import { IRootState } from "reducers";
import { showNotification } from "reducers/notifications";
import { IProfileState } from "reducers/profilesReducer";
import DetailsPageRouter from "components/Plugin/ContributionRewardExtRewarders/DetailsPageRouter";
import { combineLatest, Subscription } from "rxjs";
import DaoPluginsPage from "./DaoPluginsPage";
import DaoHistoryPage from "./DaoHistoryPage";
import DaoMembersPage from "./DaoMembersPage";
import DaoWikiPage from "./DaoWikiPage";
import * as css from "./Dao.scss";
import DaoLandingPage from "components/Dao/DaoLandingPage";
import i18next from "i18next";
import { GRAPH_POLL_INTERVAL } from "../../settings";

type IExternalProps = RouteComponentProps<any>;

interface IStateProps {
  currentAccountAddress: string;
  currentAccountProfile: IProfileState;
  daoAvatarAddress: string;
}

interface IDispatchProps {
  getProfilesForAddresses: typeof getProfilesForAddresses;
  showNotification: typeof showNotification;
}

type IProps = IExternalProps & IStateProps & IDispatchProps & ISubscriptionProps<[IDAOState, Member[]]>;

const mapStateToProps = (state: IRootState, ownProps: IExternalProps): IExternalProps & IStateProps => {
  return {
    ...ownProps,
    currentAccountAddress: state.web3.currentAccountAddress,
    currentAccountProfile: state.profiles[state.web3.currentAccountAddress],
    daoAvatarAddress: ownProps.match.params.daoAvatarAddress,
  };
};

const mapDispatchToProps = {
  getProfilesForAddresses,
  showNotification,
};

class DaoContainer extends React.Component<IProps, null> {
  public daoSubscription: any;
  public subscription: Subscription;

  public async componentDidMount() {
    this.props.getProfilesForAddresses(this.props.data[1].map((member) => member.coreState.address));
  }

  private daoHistoryRoute = (routeProps: any) => <DaoHistoryPage {...routeProps} daoState={this.props.data[0]} currentAccountAddress={this.props.currentAccountAddress} />;
  private daoMembersRoute = (routeProps: any) => <DaoMembersPage {...routeProps} daoState={this.props.data[0]} />;
  private daoWikiRoute = (routeProps: any) => <DaoWikiPage {...routeProps} daoState={this.props.data[0]} currentAccountAddress={this.props.currentAccountAddress}/>;
  private daoProposalRoute = (routeProps: any) =>
    <ProposalDetailsPage {...routeProps}
      currentAccountAddress={this.props.currentAccountAddress}
      daoState={this.props.data[0]}
      proposalId={routeProps.match.params.proposalId}
    />;
  private daoCrxProposalRoute = (routeProps: any) =>
    <DetailsPageRouter {...routeProps}
      currentAccountAddress = {this.props.currentAccountAddress}
      daoState={this.props.data[0]}
      proposalId={routeProps.match.params.proposalId}
    />;

  private pluginRoute = (routeProps: any) => <PluginContainer {...routeProps} daoState={this.props.data[0]} currentAccountAddress={this.props.currentAccountAddress} />;
  private daoPluginsRoute = (routeProps: any) => <DaoPluginsPage {...routeProps} daoState={this.props.data[0]} />;
  private daoLandingRoute = (_routeProps: any) => <DaoLandingPage daoState={this.props.data[0]} currentAccountAddress={this.props.currentAccountAddress}/>;
  private modalRoute = (route: any) => `/dao/${route.params.daoAvatarAddress}/plugin/${route.params.pluginId}/`;

  public render(): RenderOutput {
    const daoState = this.props.data[0];

    return (
      <div className={css.outer}>
        <BreadcrumbsItem to="/daos/">All DAOs</BreadcrumbsItem>
        <BreadcrumbsItem to={"/dao/" + daoState.address}>{daoState.name}</BreadcrumbsItem>
        <Helmet>
          <meta name="description" content={daoState.name + " | Managed on Alchemy by DAOstack"} />
          <meta name="og:description" content={daoState.name + " | Managed on Alchemy by DAOstack"} />
          <meta name="twitter:description" content={daoState.name + " | Managed on Alchemy by DAOstack"} />
        </Helmet>

        <div className={css.wrapper}>
          <div className={css.noticeWrapper}>
            <div className={css.noticeBuffer}></div>
            <div className={css.notice}>
              <div>
                <img src="/assets/images/Icon/notice.svg" />
                {i18next.t("Alchemy Alpha Message")}
              </div>
            </div>
          </div>
          <Switch>
            <Route exact path="/dao/:daoAvatarAddress"
              render={this.daoLandingRoute} />
            <Route exact path="/dao/:daoAvatarAddress/history"
              render={this.daoHistoryRoute} />
            <Route exact path="/dao/:daoAvatarAddress/members"
              render={this.daoMembersRoute} />
            <Route exact path="/dao/:daoAvatarAddress/wiki"
              render={this.daoWikiRoute} />

            <Route exact path="/dao/:daoAvatarAddress/proposal/:proposalId"
              render={this.daoProposalRoute}
            />

            <Route path="/dao/:daoAvatarAddress/crx/proposal/:proposalId"
              render={this.daoCrxProposalRoute} />

            <Route path="/dao/:daoAvatarAddress/plugin/:pluginId"
              render={this.pluginRoute} />

            <Route path="/dao/:daoAvatarAddress/plugins" render={this.daoPluginsRoute} />

            <Route path="/dao/:daoAvatarAddress" render={this.daoLandingRoute} />
          </Switch>

          <ModalRoute
            path="/dao/:daoAvatarAddress/plugin/:pluginId/proposals/create"
            parentPath={this.modalRoute}
            component={CreateProposalPage}
          />

        </div>
      </div>
    );
  }
}

const SubscribedDaoContainer = withSubscription({
  wrappedComponent: DaoContainer,
  loadingComponent: <Loading/>,
  errorComponent: (props) => <div>{props.error.message}</div>,
  checkForUpdate: ["daoAvatarAddress"],
  createObservable: (props: IExternalProps) => {
    const arc = getArc();
    const daoAddress = props.match.params.daoAvatarAddress;
    const dao = arc.dao(daoAddress);
    const observable = combineLatest(
      dao.state({ polling: true, pollInterval: GRAPH_POLL_INTERVAL, fetchAllData: true }), // DAO state
      dao.members()
    );
    return observable;
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(SubscribedDaoContainer);
