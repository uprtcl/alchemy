import * as React from 'react'
import { IGenericPluginProposalState } from '@daostack/arc.js'
import { utils } from "ethers";

import { deriveSecured, EveesBindings, EveesRemote, Perspective } from '@uprtcl/evees'
import { bytes32ToCid } from '@uprtcl/ipfs-provider'

import { abi as uprtclRootAbi } from './../../../UprtclRoot.min.json';
import { uprtcl } from '../../../index'
import { EveesBlockchainCached } from '@uprtcl/evees-blockchain';

interface IProps {
  proposalState: IGenericPluginProposalState;
  detailView?: boolean
  transactionModal?: boolean
}

interface IState {
  newHash: string;
  currentHash: string;
  rootPerspective: string;
  remote: string;
  loading: boolean;
}

export default class ProposalSummaryWiki extends React.Component<
  IProps,
  IState
> {
  action: any

  constructor(props: IProps) {
    super(props)
    this.state = {
      newHash: '',
      currentHash: '',
      rootPerspective: '',
      remote: '',
      loading: true
    }
  }

  async componentDidMount() {
    const {
      proposalState
    } = this.props

    this.setState({ 
      loading: true
    })

    const daoAddress = this.props.proposalState.dao.id;

    const abi = new utils.Interface(uprtclRootAbi);
    const decodedCallData = abi.decodeFunctionData('updateHead(bytes32,bytes32,address)', proposalState.callData);

    const eveesEthereum = uprtcl.orchestrator.container
      .getAll(EveesBindings.EveesRemote)
      .find((provider: EveesRemote) =>
        provider.id.startsWith('eth'),
      ) as EveesBlockchainCached

    const currentHash = await eveesEthereum.getEveesHeadOf(daoAddress);
    const newHash = bytes32ToCid([decodedCallData[0], decodedCallData[1]]);

    /** Root perspective is used to show the changes for the first update where there is no updates */
    const object: Perspective = {
      creatorId: daoAddress,
      remote: eveesEthereum.id,
      path: daoAddress,
      timestamp: 0,
      context: `${daoAddress}.home`,
    };

    const secured = await deriveSecured<Perspective>(
      object,
      eveesEthereum.store.cidConfig
    );

    const rootPerspective = secured.id

    const newState = { 
      newHash,
      currentHash,
      rootPerspective,
      remote: eveesEthereum.id,
      loading: false
    }
    console.log('[Uprtcl] set diff', newState);

    this.setState(newState);
  }

  public render(): RenderOutput {
    const style: any = !this.props.detailView
      ? { maxHeight: '300px', overflowY: 'auto', whiteSpace: 'normal' }
      : { whiteSpace: 'normal' }

    if (this.state.loading) {
      return (<span>loading...</span>)
    }

    return (
      <div style={style}>
        <module-container>
          <evees-blockchain-update-diff
            current-hash={this.state.currentHash } 
            new-hash={this.state.newHash}
            root-perspective={this.state.rootPerspective}
            remote={this.state.remote}
          ></evees-blockchain-update-diff>
        </module-container>
      </div>
    )
  }
}
