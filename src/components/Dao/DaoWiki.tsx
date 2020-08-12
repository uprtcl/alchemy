import * as React from "react";
import classNames from "classnames";
import { IDAOState, ISchemeState, Scheme, IProposalType, Proposal, IProposalState, IProposalStage } from "@daostack/arc.js";
import { enableWalletProvider } from "arc";

import { connect } from "react-redux";
import { combineLatest } from "rxjs";
import Loading from "components/Shared/Loading";

import {  RouteComponentProps, Link } from "react-router-dom";
import * as arcActions from "actions/arcActions";
import { showNotification, NotificationStatus } from "reducers/notifications";
import { schemeName, getSchemeIsActive } from "lib/schemeUtils";
import withSubscription, { ISubscriptionProps } from "components/Shared/withSubscription";

const uprtclHomeDetails = require('./UprtclHomePerspectives.min.json');

interface IGenericSchemeProposal {
  methodName: string;
  methodParams: Array<string | number>; 
}

export const getHomePerspective = async (uprtclHome: any, address: string) => {
  const events = await uprtclHome.getPastEvents('HomePerspectiveSet', {
    filter: { owner: address },
    fromBlock: 0,
  });

  if (events.length === 0) return '';

  const last = events
    .sort((e1: any, e2: any) => (e1.blockNumber > e2.blockNumber ? 1 : -1))
    .pop();

  return last.returnValues.perspectiveId;
};

import { uprtcl } from '../../index';

import * as daoStyle from "./Dao.scss";
import * as proposalStyle from "../Scheme/SchemeProposals.scss";
import { EveesBindings, EveesRemote, EveesHelpers, EveesEthereum, EveesHttp } from "@uprtcl/evees";
import { ApolloClientModule } from "@uprtcl/graphql";
import { ApolloClient } from "apollo-boost";
import { Wiki } from "@uprtcl/wikis";
import { EthereumContract } from "@uprtcl/ethereum-provider";
import { Action, GenericSchemeRegistry } from "genericSchemeRegistry";
import { createRef } from "react";

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
  loading: boolean;
  hasWikiScheme: boolean;
  wikiId: string | undefined;
  isActive: boolean;
  schemeAddress: string;
}

class DaoWiki extends React.Component<IProps, IState> {
  schemes: Scheme[];
  proposals: Proposal[];
  defaultRemote: EveesRemote;
  wikiUpdateScheme: ISchemeState;
  eveesEthereum: EveesEthereum;
  eveesHttp: EveesHttp;
  homePerspectivesContract: EthereumContract;

  private container = createRef<HTMLDivElement>();

  constructor(props: IProps) {
    super(props);
    this.state = {
      loading: true,
      hasWikiScheme: false,
      wikiId: undefined,
      isActive: false,
      schemeAddress: ''
    };
    this.schemes = props.data[0];
    this.proposals = props.data[1];

    this.defaultRemote = uprtcl.orchestrator.container.get(EveesBindings.DefaultRemote);
    this.eveesEthereum = uprtcl.orchestrator.container.getAll(
      EveesBindings.EveesRemote
    ).find((provider: EveesRemote) =>
      provider.id.startsWith('eth')
    ) as EveesEthereum;

    this.eveesHttp = uprtcl.orchestrator.container.getAll(
      EveesBindings.EveesRemote
    ).find((provider: EveesRemote) =>
      provider.id.startsWith('http')
    ) as EveesHttp;

    this.homePerspectivesContract = new EthereumContract(
    {
      contract: {
        abi: uprtclHomeDetails.abi,
        networks: uprtclHomeDetails.networks,
      },
    },
    this.eveesEthereum.ethConnection);
  }

  componentWillMount() {
    this.load();
  }

  componentDidMount() {
    if (this.container.current == null) return;

    this.container.current.addEventListener('evees-proposal-created', async (e: any) => {
      debugger
      this.createProposal({
        methodName: 'authorizeProposal',
        methodParams: [e.detail.proposalId, '1', true],
      });
    });
  }

  async load() {
    this.setState({loading: true});

    await this.eveesEthereum.ready();
    await this.eveesHttp.connect();
    await this.homePerspectivesContract.ready();

    await Promise.all([
      this.checkIfWikiSchemeExists(),
      this.checkWiki()]);
    
    this.setState({loading: false});
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
      this.wikiUpdateScheme = states.find(hasWikiScheme);
      this.setState({ isActive: getSchemeIsActive(this.wikiUpdateScheme) });
      this.setState({ schemeAddress: this.wikiUpdateScheme.id });

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

  async checkWiki() {
    const wikiId = await getHomePerspective(this.homePerspectivesContract.contractInstance, this.props.daoState.address);
    this.setState({ wikiId: wikiId });
  };

  async createWiki() {
    const client = uprtcl.orchestrator.container.get(
      ApolloClientModule.bindings.Client
    ) as ApolloClient<any>;

    const wiki: Wiki = {
      title: `${this.props.daoState.name} Wiki`,
      pages: [],
    };

    const dataId = await EveesHelpers.createEntity(
      client,
      this.eveesEthereum.store,
      wiki
    );
    const headId = await EveesHelpers.createCommit(client, this.eveesEthereum.store, {
      dataId,
    });

    const randint = 0 + Math.floor((1000000000 - 0) * Math.random());

    const wikiId = await EveesHelpers.createPerspective(client, this.eveesEthereum, {
      headId,
      context: `${this.props.daoState.name}-wiki-${randint}`,
      canWrite: this.props.daoState.address
    }); 

    const proposalValues = {
      methodName: 'setHomePerspective',
      methodParams: [wikiId],
    };
    
    await this.createProposal(proposalValues);

    this.load();
  }

  async createProposal(proposalOptions: IGenericSchemeProposal) {
    const genericSchemeRegistry = new GenericSchemeRegistry();
    const genericSchemeInfo = genericSchemeRegistry.getSchemeInfo(
      (this.wikiUpdateScheme.schemeParams as any).contractToCall
    );
    const availableActions = genericSchemeInfo.actions();
    const actionCalled = availableActions.find(
      (action: Action) => action.id === proposalOptions.methodName
    );
    const dataEncoded = genericSchemeInfo.encodeABI(
      actionCalled,
      proposalOptions.methodParams
    );
    const proposalOptionsDetailed = {
      dao: this.wikiUpdateScheme.dao,
      scheme: this.wikiUpdateScheme.address,
      type: IProposalType.GenericScheme,
      value: 0, // amount of eth to send with the call
      title: actionCalled.label,
      description: actionCalled.description,
      callData: dataEncoded,
    };
    this.props.createProposal(proposalOptionsDetailed);
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

  renderInitializeWiki() {
    return (
      <div className="container">
        <div className="header">The Wiki for this DAO has not yet been created</div>
        <a
          href="javascript:void(0)"
          className="blueButton"
          onClick={() => this.createWiki()}
        >
          Create
        </a>
      </div>
    );
  };

  renderWiki() {
    return (
      <div style={{ marginTop: '-31px', minHeight: 'calc(100vh - 241px)', display: 'flex', flexDirection: 'column' }}>
        <module-container style={{flexGrow: '1', flexDirection: 'column', display: 'flex' }}>
          <wiki-drawer uref={this.state.wikiId} default-remote={this.defaultRemote.id}></wiki-drawer>
        </module-container>
      </div>
    );
  }

  public render() {
    let content: any;

    if (this.state.loading) {
      content = (<h1>Loading</h1>);
    } else if (!this.state.hasWikiScheme) {
      content = this.renderNoWikiScheme() ;
    } else if (this.state.wikiId === undefined || this.state.wikiId === '') {
      content = this.renderInitializeWiki();
    } else {
      content = this.renderWiki();
    }
    
    return (
      <div>
        <div className={daoStyle.daoHistoryHeader}>Wiki</div>
        <div ref={this.container}>
          {content}
        </div>
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
