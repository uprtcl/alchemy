import * as React from "react";
import Web3 from "web3";
import { IDAOState, ISchemeState, Scheme, IProposalType, Proposal, IProposalState, IProposalStage } from "@daostack/arc.js";
import classNames from "classnames";
import { enableWalletProvider, getWeb3Provider } from "arc";

import { connect } from "react-redux";
import { combineLatest } from "rxjs";
import Loading from "components/Shared/Loading";

import { Link, RouteComponentProps } from "react-router-dom";
import * as arcActions from "actions/arcActions";
import { showNotification, NotificationStatus } from "reducers/notifications";
import { schemeName, getSchemeIsActive } from "lib/schemeUtils";
import withSubscription, { ISubscriptionProps } from "components/Shared/withSubscription";

import {
  abi as abiHome,
  networks as networksHome,
} from './UprtclHomePerspectives.min.json';

import * as daoStyle from "./Dao.scss";
import * as proposalStyle from "../Scheme/SchemeProposals.scss";

type IExternalProps = {
  daoState: IDAOState;
  currentAccountAddress: string;
} & RouteComponentProps<any>;


const mapDispatchToProps = {
  createProposal: arcActions.createProposal,
  voteOnProposal: arcActions.voteOnProposal,
  showNotification,
};
interface IDispatchProps {
  createProposal: typeof arcActions.createProposal;
  voteOnProposal: typeof arcActions.voteOnProposal;
  showNotification: typeof showNotification;
}

type SubscriptionData = ISubscriptionProps<[Scheme[], Proposal[]]>;
type IProps = IDispatchProps & IExternalProps & SubscriptionData;
type IState = {
  hasWikiScheme: boolean;
  hasWiki: boolean;
  wikiId: string | undefined;
  isActive: boolean;
  schemeAddress: string;
}

 class DaoWiki extends React.Component<IProps, IState> {
  schemes: Scheme[];
  proposals: Proposal[];

  constructor(props: IProps) {
    super(props);
    this.state = {
      hasWikiScheme: false,
      hasWiki: false,
      wikiId: undefined,
      isActive: false,
      schemeAddress: ''
    };
    this.schemes = props.data[0];
    this.proposals = props.data[1];
  }

  componentWillMount() {
    this.checkIfWikiSchemeExists();
    this.checkHome();
  }

  // Check Wiki Scheme
  async checkIfWikiSchemeExists() {
    const genericSchemes = this.schemes.filter((scheme: Scheme) => scheme.staticState.name === "GenericScheme");
    const states: ISchemeState[] = [];
    const getSchemeState = () => {
      return new Promise((resolve, reject) => {
        try {
          genericSchemes.map((scheme: Scheme) => scheme.state().subscribe((state: any) => states.push(state)));
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    };
    await getSchemeState();
    const hasWikiScheme = (schemeState: ISchemeState) => {
      return "underscore protocol" === schemeName(schemeState, "[Unknown]");
    };
    const wikiSchemeExists = states.some(hasWikiScheme);
    this.setState({ hasWikiScheme: wikiSchemeExists });

    if (wikiSchemeExists) {
      if (!(await enableWalletProvider({ showNotification: this.props.showNotification }))) {
        this.props.showNotification(NotificationStatus.Failure, "You must be logged in to use Wiki!");
        return;
      }
      const wikiUpdateScheme = states.find(hasWikiScheme);
      this.setState({ isActive: getSchemeIsActive(wikiUpdateScheme) });
      const web3Provider = await getWeb3Provider();
      console.log(web3Provider);
      this.setState({ schemeAddress: wikiUpdateScheme.id });

      const checkProposals = (proposal: Proposal) => {
        const state = proposal.staticState as IProposalState;
        return state.title === "Set home perspective";
      };

      const homeProposalExists = this.proposals.some(checkProposals);
      console.log(homeProposalExists);

    }
  };

  async registerWikiScheme() {
    if (!(await enableWalletProvider({ showNotification: this.props.showNotification }))) {
      return;
    }

    const checkProposals = (proposal: Proposal) => {
      const state = proposal.staticState as IProposalState;
      return state.title === "Creation of WikiUpdate scheme";
    };

    const wikiProposalAlreadyExists = this.proposals.some(checkProposals);
    const dao = this.props.daoState.address;
    const schemeRegistrar = this.schemes.find((scheme: Scheme) => scheme.staticState.name === "SchemeRegistrar");

    if (wikiProposalAlreadyExists) {
      this.props.showNotification(NotificationStatus.Success, "Wiki Scheme proposal has already been created!");
      this.props.history.replace(`/dao/${dao}/scheme/${schemeRegistrar.id}`);
    } else {
      const proposalValues = {
        dao,
        type: IProposalType.SchemeRegistrarAdd,
        permissions: "0x" + (17).toString(16).padStart(8, "0"),
        value: 0,
        tags: ["Wiki"],
        title: "Creation of WikiUpdate scheme",
        description: "This will allow DAO to have Wiki functionality",
        parametersHash: "0x00000000000000000000000000000000000000000",
        scheme: schemeRegistrar.staticState.address,
        schemeToRegister: "0x0800340862fCA767b3007fE3b297f5F16a441dC8", // rinkeby
      };
      await this.props.createProposal(proposalValues);
    }
  };

  async checkHome() {
    const provider = await getWeb3Provider();
    const web3 = new Web3(provider);
  
    const networkId = await web3.eth.net.getId();
    const contractInstance = new web3.eth.Contract(
      abiHome,
      networksHome[networkId]
    );
    console.log(contractInstance)

    const events = await contractInstance.getPastEvents('HomePerspectiveSet', {
      filter: { owner: this.props.daoState.address },
      fromBlock: 0,
    });
  
    if (events.length === 0) return '';
    
    const last = events
      .sort((e1, e2) => (e1.blockNumber > e2.blockNumber ? 1 : -1))
      .pop();
  
    const wikiId = last.returnValues.perspectiveId;

    this.setState({ wikiId: wikiId, hasWiki: wikiId !== ''});
  };

  renderNoWikiScheme() {
    return (
      <div className={proposalStyle.noDecisions}>
        <img className={proposalStyle.relax} src="/assets/images/yogaman.svg" />
        <div className={proposalStyle.proposalsHeader}>Wiki scheme not registered on this DAO yet</div>
        <p>You can create the proposal to register it today! (:</p>
        <div className={proposalStyle.cta}>
          <Link to={"/dao/" + this.props.daoState.address}>
            <img className={proposalStyle.relax} src="/assets/images/lt.svg" /> Back to home
          </Link>
          <a
            className={classNames({
              [proposalStyle.blueButton]: true,
            })}
            onClick={this.registerWikiScheme}
            data-test-id="createProposal"
          >
            + Register wiki scheme
          </a>
        </div>
      </div>
    );
  }

  public render() {
    return (
      <div>
        <div className={daoStyle.daoHistoryHeader}>Wiki</div>
        {this.state.hasWikiScheme && this.props.currentAccountAddress ? (
          <div style={{ marginTop: '-31px', minHeight: 'calc(100vh - 241px)', display: 'flex', flexDirection: 'column' }}>
            <module-container style={{flexGrow: '1', flexDirection: 'column', display: 'flex' }}>
              <wiki-drawer uref={this.state.wikiId}></wiki-drawer>
            </module-container>
          </div>
        ) : !this.props.currentAccountAddress ? (
          <div className={proposalStyle.noDecisions}>
            <div className={proposalStyle.proposalsHeader}>You must be logged in to interact with Wiki</div>
          </div>
        ) : this.renderNoWikiScheme() }
      </div>
    );
  }  
}

const SubscribedDaoWiki = withSubscription({
  wrappedComponent: DaoWiki,
  loadingComponent: <Loading />,
  errorComponent: (props: any) => <span>{props.error.message}</span>,
  checkForUpdate: [],
  createObservable: async (props: IExternalProps) => {
    const dao = props.daoState.dao;
    return combineLatest(
      dao.schemes({}, { fetchAllData: true }),
      dao.proposals({ where: { stage: IProposalStage.Queued } }, { subscribe: true, fetchAllData: true })
    );
  },
});

export default connect(
  null,
  mapDispatchToProps
)(SubscribedDaoWiki);
