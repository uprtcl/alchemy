import * as React from 'react'
import {
  AnyPlugin,
  DAO,
  IDAOState,
  IPluginState,
  Plugin
} from '@daostack/arc.js'

import { connect } from 'react-redux'
import Loading from 'components/Shared/Loading'

import { RouteComponentProps } from 'react-router-dom'
import * as arcActions from 'actions/arcActions'
import { showNotification } from 'reducers/notifications'
import withSubscription, {
  ISubscriptionProps,
} from 'components/Shared/withSubscription'

import * as daoStyle from './Dao.scss'

import { EveesRemote, EveesModule, Perspective, deriveSecured, EveesConfig } from '@uprtcl/evees'
import { EthereumContract } from '@uprtcl/ethereum-provider'

import { combineLatest, Observable, of } from 'rxjs'
import { getArc } from 'arc'
import { mergeMap } from 'rxjs/operators'

import { GRAPH_POLL_INTERVAL } from "../../settings";
import { uprtcl } from '../../index'

type IExternalProps = {
  daoState: IDAOState
  currentAccountAddress: string
} & RouteComponentProps<any>

const mapDispatchToProps = {
  createProposal: arcActions.createProposal,
  voteOnProposal: arcActions.voteOnProposal,
  showNotification,
}
interface IDispatchProps {
  createProposal: typeof arcActions.createProposal
  voteOnProposal: typeof arcActions.voteOnProposal
  showNotification: typeof showNotification
}

type IProps = IExternalProps & ISubscriptionProps<[AnyPlugin[], IPluginState]> & IDispatchProps;
type IState = {
  loading: boolean
  hasWikiScheme: boolean
  wikiId: string | undefined
  isActive: boolean
  schemeAddress: string
}

class DaoWikiPage extends React.Component<IProps, IState> {
  defaultRemote: EveesRemote
  officialRemote: EveesRemote
  
  homePerspectivesContract: EthereumContract

  private container = React.createRef<HTMLDivElement>()

  constructor(props: IProps) {
    super(props)
    this.state = {
      loading: true,
      hasWikiScheme: false,
      wikiId: undefined,
      isActive: false,
      schemeAddress: '',
    }

    const config = (uprtcl.orchestrator.container.get(
      EveesModule.bindings.Config
    ) as EveesConfig);
    
    this.defaultRemote = config.defaultRemote;

    this.officialRemote = (uprtcl.orchestrator.container.getAll(
      EveesModule.bindings.EveesRemote
    ) as EveesRemote[]).find(remote => remote.id.includes('eth'));

    //** locally changing the evees config to fit this DAO */
    config.emitIf = {
      owner: this.props.daoState.address,
      remote: this.officialRemote.id
    }
  }

  componentWillMount() {
    this.load()
  }

  componentDidMount() {
    if (this.container.current == null) return

    this.container.current.addEventListener(
      'evees-proposal',
      async (e: any) => {
        console.log('Event received', e)
        // this.createProposal({
        //   methodName: 'authorizeProposal',
        //   methodParams: [e.detail.proposalId, '1', true],
        // })
      },
    )
  }

  async load() {
    this.setState({ loading: true })
    await this.setWikiId();
    this.setState({ loading: false })
  }

  async setWikiId() {
    const object: Perspective = {
      creatorId: this.props.daoState.address,
      remote: this.officialRemote.id,
      path: this.props.daoState.address,
      timestamp: 0,
      context: 'home'
    };

    const secured = await deriveSecured<Perspective>(object, this.officialRemote.store.cidConfig);
    await this.officialRemote.store.create(secured.object);
    
    this.setState({ wikiId: secured.id })
  }

  renderWiki() {
    return (
      <div
        style={{
          marginTop: '-31px',
          minHeight: 'calc(100vh - 241px)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          whiteSpace: 'normal'
        }}
      >
        <module-container
          style={{ flexGrow: '1', flexDirection: 'column', display: 'flex' }}
        >
          <wiki-drawer
            uref={this.state.wikiId}
            default-remote={this.defaultRemote.id}
          ></wiki-drawer>
        </module-container>
      </div>
    )
  }

  public render() {
    let content: any

    if (this.state.loading) {
      content = <h1>Loading</h1>
    } else {
      content = this.renderWiki()
    }

    return (
      <div>
        <div className={daoStyle.daoHistoryHeader}>Wiki</div>
        <div ref={this.container}>{content}</div>
      </div>
    )
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
      dao.plugins({ where: { isRegistered: true } }, { fetchAllData: true, polling: true, pollInterval: GRAPH_POLL_INTERVAL }),
      // Find the SchemeFactory plugin if this dao has one
      Plugin.search(arc, { where: { dao: dao.id, name: "SchemeFactory" } }).pipe(mergeMap((plugin: Array<AnyPlugin>): Observable<IPluginState> => plugin[0] ? plugin[0].state() : of(null)))
    );
  },
})

export default connect(null, mapDispatchToProps)(SubscribedDaoWiki)
