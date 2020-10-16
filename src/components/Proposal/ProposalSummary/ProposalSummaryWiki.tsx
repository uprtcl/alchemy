import * as React from 'react'
import { IGenericPluginProposalState } from '@daostack/arc.js'
import { utils } from "ethers";

import { EveesBindings, EveesRemote } from '@uprtcl/evees'
import { bytes32ToCid } from '@uprtcl/ipfs-provider'

import { abi as uprtclRootAbi } from './../../../UprtclRoot.min.json';
import { uprtcl } from '../../../index'

interface IProps {
  proposalState: IGenericPluginProposalState;
  detailView?: boolean
  transactionModal?: boolean
}

interface IState {
  newHash: string;
  remote: string;
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
      remote: ''
    }
  }

  async componentDidMount() {
    const {
      proposalState
    } = this.props
    
    const abi = new utils.Interface(uprtclRootAbi);
    const decodedCallData = abi.decodeFunctionData('updateHead(bytes32,bytes32,address)', proposalState.callData);

    const eveesEthereum = uprtcl.orchestrator.container
      .getAll(EveesBindings.EveesRemote)
      .find((provider: EveesRemote) =>
        provider.id.startsWith('eth'),
      ) as EveesRemote

    const newHash = bytes32ToCid([decodedCallData[0], decodedCallData[1]]);
    this.setState({ 
      ...this.state, 
      newHash, 
      remote: eveesEthereum.id 
    });
  }

  public render(): RenderOutput {
    const style: any = !this.props.detailView
      ? { maxHeight: '300px', overflowY: 'auto', whiteSpace: 'normal' }
      : { whiteSpace: 'normal' }

    return (
      <div style={style}>
        <module-container>
          <evees-blockchain-update-diff
            owner={ this.props.proposalState.dao.id } 
            new-hash={this.state.newHash}
            remote={this.state.remote}
          ></evees-blockchain-update-diff>
        </module-container>
      </div>
    )
  }
}
