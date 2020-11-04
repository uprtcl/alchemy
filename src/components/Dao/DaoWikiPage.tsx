import * as React from "react";
import {
  AnyPlugin,
  DAO,
  GenericPlugin,
  IDAOState,
  IPluginState,
  IProposalCreateOptionsPM,
  LATEST_ARC_VERSION,
  Plugin,
} from "@daostack/arc.js";

import { connect } from "react-redux";
import Loading from "components/Shared/Loading";

import { Link, RouteComponentProps } from "react-router-dom";
import classNames from "classnames";

import * as arcActions from "actions/arcActions";
import { showNotification } from "reducers/notifications";
import withSubscription, {
  ISubscriptionProps,
} from "components/Shared/withSubscription";

import * as proposalStyle from "../Plugin/PluginProposals.scss";
import * as wikiStyle from "./DaoWikiPage.scss";

import {
  EveesRemote,
  EveesModule,
  Perspective,
  deriveSecured,
  EveesConfig,
  ProposalDetails,
} from "@uprtcl/evees";
import { EthereumContract } from "@uprtcl/ethereum-provider";

import { combineLatest, Observable, of } from "rxjs";
import { enableWalletProvider, getArc } from "arc";
import { mergeMap } from "rxjs/operators";

import { GRAPH_POLL_INTERVAL } from "../../settings";
import { uprtcl } from "../../index";
import { EveesBlockchainCached } from "@uprtcl/evees-blockchain";
import { ProposalCreatedEvent } from "@uprtcl/evees/dist/types/types";
import { encodeABI } from "components/Proposal/Create/PluginForms/ABIService";
import { abi as uprtclRootAbi } from "./../../UprtclRoot.min.json";
import { cidToHex32 } from "@uprtcl/ipfs-provider";
import { EveesOrbitDBEntities } from "@uprtcl/evees-orbitdb";

const ZERO_HEX_32 = "0x" + new Array(64).fill(0).join("");
const ZERO_ADDRESS = "0x" + new Array(40).fill(0).join("");

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

type IProps = IExternalProps &
  ISubscriptionProps<[AnyPlugin[], IPluginState]> &
  IDispatchProps;
type IState = {
  loading: boolean;
  wikiId: string | undefined;
  wikiPlugin: GenericPlugin;
};

class DaoWikiPage extends React.Component<IProps, IState> {
  defaultRemote: EveesRemote;
  officialRemote: EveesBlockchainCached;
  wikiPlugin: GenericPlugin;
  plugins: AnyPlugin[];

  homePerspectivesContract: EthereumContract;

  private container = React.createRef<HTMLDivElement>();

  constructor(props: IProps) {
    super(props);
    this.state = {
      loading: true,
      wikiPlugin: null,
      wikiId: undefined,
    };

    const config = uprtcl.orchestrator.container.get(
      EveesModule.bindings.Config
    ) as EveesConfig;

    this.defaultRemote = config.defaultRemote;

    this.officialRemote = (uprtcl.orchestrator.container.getAll(
      EveesModule.bindings.EveesRemote
    ) as EveesBlockchainCached[]).find((remote) => remote.id.includes("eth"));

    //** locally changing the evees config to fit this DAO */
    config.emitIf = {
      owner: this.props.daoState.address,
      remote: this.officialRemote.id,
    };

    this.plugins = props.data[0];
  }

  componentWillMount() {
    this.load();
  }

  componentDidMount() {
    if (this.container.current == null) return;

    this.container.current.addEventListener(
      "evees-proposal",
      async (e: ProposalCreatedEvent) => {
        this.proposeUpdate(e.detail.proposalDetails);
      }
    );
  }

  // Check Wiki Scheme
  async checkWikiPlugin() {
    const wikiPlugin = this.plugins.find((plugin: any) => {
      return (
        plugin.coreState.name === "GenericScheme" &&
        plugin.coreState.pluginParams.contractToCall !== undefined &&
        plugin.coreState.pluginParams.contractToCall ===
          "0x6a781148eedd06350159bf05d37e059d8974294e"
      );
    });
    this.setState({ wikiPlugin: wikiPlugin as GenericPlugin });
  }

  async registerWikiPlugin() {
    if (
      !(await enableWalletProvider({
        showNotification: this.props.showNotification,
      }))
    ) {
      return;
    }

    const arc = getArc();
    const votingMachine = arc.getContractInfoByName(
      "GenesisProtocol",
      LATEST_ARC_VERSION
    ).address;
    const pluginManagerAddress = this.plugins.find(
      (p) => p.coreState.name === "SchemeFactory"
    ).coreState.address;

    const proposalOptions: IProposalCreateOptionsPM = {
      add: {
        permissions: "0x00000011",
        pluginInitParams: {
          contractToCall: "0x6a781148eEdd06350159Bf05d37E059d8974294e",
          daoId: this.props.daoState.address,
          voteOnBehalf: "0x0000000000000000000000000000000000000000",
          voteParamsHash:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          votingMachine: votingMachine,
          votingParams: [
            '50',
            '2592000',
            '86400',
            '86400',
            '1200',
            '172800',
            '50',
            '4',
            '150',
            '10',
            '1603554900',
          ],
        },
        pluginName: "GenericScheme",
      },
      dao: this.props.daoState.address,
      description: "Adds a _Prtcl-powered Wiki plugin to this DAO.",
      plugin: pluginManagerAddress,
      tags: ["wiki"],
      title: "Register Wiki Plugin",
      url: "",
    };
    
    await this.props.createProposal(proposalOptions);

    /** we need to create the contextStore and add the wikiId already
     * as we don't know how to react to the proposal having passed
     */
    const contextStore = await (this
      .officialRemote as any).orbitdbcustom.getStore(
      EveesOrbitDBEntities.Context,
      {
        context: this.wikiContext(),
      },
      true
    );
    const wikiId = await this.getWikiId();
    await contextStore.add(wikiId);
  }

  async proposeUpdate(details: ProposalDetails) {
    const eveesData = await this.officialRemote.getEveesDataOf(
      this.props.daoState.address
    );

    details.newPerspectives.map((newPerspective) => {
      eveesData[newPerspective.perspective.id] = {
        headId: newPerspective.details.headId,
      };
    });
    details.updates.map((update) => {
      eveesData[update.perspectiveId] = { headId: update.newHeadId };
    });

    const newEveesDetailsHash = await this.officialRemote.store.create(
      eveesData
    );
    const headCidParts = cidToHex32(newEveesDetailsHash);

    const dataEncoded = encodeABI(
      uprtclRootAbi,
      "updateHead(bytes32,bytes32,address)",
      [
        { value: headCidParts[0] },
        { value: headCidParts[1] },
        { value: ZERO_ADDRESS },
      ]
    );

    /* need to add the new perspectives to their context stores here because I can't do it
    once the proposal has passed. */
    await Promise.all(
      details.newPerspectives.map(async (newPerspective) => {
        const contextStore = await (this
          .officialRemote as any).orbitdbcustom.getStore(
          EveesOrbitDBEntities.Context,
          {
            context: newPerspective.perspective.object.payload.context,
          },
          true
        );
        await contextStore.add(newPerspective.perspective.id);
      })
    );

    this.createUpdateProposal(dataEncoded);
  }

  async resetDaoEvees() {
    const perspectiveIds = await this.officialRemote.getContextPerspectives(
      this.wikiContext()
    );

    /** make sure the wikiId is part of the context store  */
    const wikiId = await this.getWikiId();
    if (!perspectiveIds.includes(wikiId)) {
      const contextStore = await (this
        .officialRemote as any).orbitdbcustom.getStore(
        EveesOrbitDBEntities.Context,
        {
          context: this.wikiContext(),
        },
        true
      );
      await contextStore.add(wikiId);
    }

    /** reset evees data of the DAO */
    const dataEncoded = encodeABI(
      uprtclRootAbi,
      "updateHead(bytes32,bytes32,address)",
      [{ value: ZERO_HEX_32 }, { value: ZERO_HEX_32 }, { value: ZERO_ADDRESS }]
    );

    this.createUpdateProposal(dataEncoded);
  }

  async createUpdateProposal(dataEncoded: string) {
    if (
      !(await enableWalletProvider({
        showNotification: this.props.showNotification,
      }))
    ) {
      return;
    }

    const proposalOptionsDetailed = {
      dao: this.state.wikiPlugin.coreState.dao.id,
      title: "Update _Prtcl Evees",
      description: "Update _Prtcl content owned by this DAO",
      plugin: this.state.wikiPlugin.coreState.address,
      callData: dataEncoded,
      value: 0,
    };
    this.props.createProposal(proposalOptionsDetailed);
  }

  async load() {
    this.setState({ loading: true });
    const wikiId = await this.getWikiId();
    this.setState({ wikiId });
    await this.checkWikiPlugin();
    this.setState({ loading: false });
  }

  wikiContext() {
    return `${this.props.daoState.address}.home`;
  }

  async getWikiId(): Promise<string> {
    const object: Perspective = {
      creatorId: this.props.daoState.address,
      remote: this.officialRemote.id,
      path: this.props.daoState.address,
      timestamp: 0,
      context: this.wikiContext(),
    };

    const secured = await deriveSecured<Perspective>(
      object,
      this.officialRemote.store.cidConfig
    );
    return this.officialRemote.store.create(secured.object);
  }

  renderWiki() {
    return (
      <div className={wikiStyle.wikiContainer}>
        {/* <button onClick={() => this.resetDaoEvees()}>reset</button> */}
        <module-container
          style={{ flexGrow: "1", flexDirection: "column", display: "flex" }}
        >
          <wiki-drawer
            uref={this.state.wikiId}
            check-owner
          ></wiki-drawer>
        </module-container>
      </div>
    );
  }

  renderNoWikiScheme() {
    return (
      <div className={proposalStyle.noDecisions}>
        <img className={proposalStyle.relax} src="/assets/images/yogaman.svg" />
        <div className={proposalStyle.proposalsHeader}>
          You need to register a plugin to use the Wiki
        </div>
        <div className={proposalStyle.cta}>
          <Link to={"/dao/" + this.props.daoState.address}>
            <img className={proposalStyle.relax} src="/assets/images/lt.svg" />{" "}
            Back
          </Link>
          <a
            className={classNames({
              [proposalStyle.blueButton]: true,
            })}
            onClick={() => this.registerWikiPlugin()}
            data-test-id="createProposal"
          >
            + Register wiki plugin
          </a>
        </div>
      </div>
    );
  }

  public render() {
    let content: any;

    if (this.state.loading) {
      content = <h1>Loading</h1>;
    } else {
      if (this.state.wikiPlugin != null) {
        content = this.renderWiki();
      } else {
        content = this.renderNoWikiScheme();
      }
    }

    return (
      <div>
        <div className={wikiStyle.wikiHeader}>Wiki</div>
        <div ref={this.container}>{content}</div>
      </div>
    );
  }
}

const SubscribedDaoWiki = withSubscription({
  wrappedComponent: DaoWikiPage,
  loadingComponent: <Loading />,
  errorComponent: (props: any) => <span>{props.error.message}</span>,
  checkForUpdate: [],
  createObservable: async (props: IExternalProps) => {
    const arc = getArc();
    const dao = new DAO(arc, props.daoState);

    return combineLatest(
      dao.plugins(
        { where: { isRegistered: true } },
        { fetchAllData: true, polling: true, pollInterval: GRAPH_POLL_INTERVAL }
      ),
      // Find the SchemeFactory plugin if this dao has one
      Plugin.search(arc, {
        where: { dao: dao.id, name: "SchemeFactory" },
      }).pipe(
        mergeMap(
          (plugin: Array<AnyPlugin>): Observable<IPluginState> =>
            plugin[0] ? plugin[0].state() : of(null)
        )
      )
    );
  },
});

export default connect(null, mapDispatchToProps)(SubscribedDaoWiki);
