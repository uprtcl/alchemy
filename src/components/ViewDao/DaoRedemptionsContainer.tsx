import * as classNames from "classnames";
import { denormalize } from "normalizr";
import Tooltip from 'rc-tooltip';
import * as React from "react";
import { connect, Dispatch } from "react-redux";
import { Link, RouteComponentProps } from "react-router-dom";

import * as arcActions from "actions/arcActions";
import { IRootState } from "reducers";
import { IDaoState, IProposalState, IRedemptionState } from "reducers/arcReducer";
import { IWeb3State } from "reducers/web3Reducer";
import * as selectors from "selectors/daoSelectors";
import * as schemas from "../../schemas";

import ProposalContainer from "../Proposal/ProposalContainer";
import DaoHeader from "./DaoHeader";
import DaoNav from "./DaoNav";

import * as css from "./ViewDao.scss";

interface IStateProps extends RouteComponentProps<any> {
  currentAccountAddress: string;
  dao: IDaoState;
  proposals: IProposalState[];
  redemptions: IRedemptionState[];
}

const mapStateToProps = (state: IRootState, ownProps: any) => {
  const dao = state.arc.daos[ownProps.match.params.daoAddress];
  const redemptions = dao.members[state.web3.ethAccountAddress].redemptions;
  let redemptionsList: IRedemptionState[] = [];

  if (dao) {
    const redemptions = dao.members[state.web3.ethAccountAddress].redemptions;
    redemptionsList = Object.keys(redemptions).map((proposalId) => {
      const redemption = redemptions[proposalId];
      redemption.proposal = state.arc.proposals[proposalId];
      return redemption;
    });
  }
  const proposals = Object.keys(redemptions).map((proposalId) => state.arc.proposals[proposalId]);

  return {
    currentAccountAddress: state.web3.ethAccountAddress,
    dao,
    proposals,
    redemptions: redemptionsList,
  };
};

interface IDispatchProps {
  redeemProposal: typeof arcActions.redeemProposal;
}

const mapDispatchToProps = {
  redeemProposal: arcActions.redeemProposal,
};

type IProps = IStateProps & IDispatchProps;

class DaoRedemptionsContainer extends React.Component<IProps, null> {

  public handleClickRedeem(event: any) {
    const { dao, currentAccountAddress, redemptions, redeemProposal } = this.props;
    redemptions.forEach(async (redemption) => {
      await redeemProposal(dao.avatarAddress, redemption.proposal, currentAccountAddress);
    });
  }

  public render() {
    const { dao, proposals, redemptions } = this.props;

    const proposalsHTML = proposals.map((proposal: IProposalState) => {
      return (<ProposalContainer key={"proposal_" + proposal.proposalId} proposalId={proposal.proposalId} />);
    });

    let redeemAllTip: JSX.Element | string = "", ethReward = 0, nativeReward = 0, reputationReward = 0;
    if (redemptions.length > 0) {
      redemptions.forEach(async (redemption) => {
        ethReward += redemption.beneficiaryEth;
        nativeReward += redemption.voterTokens + redemption.stakerTokens + redemption.beneficiaryNativeToken;
        reputationReward += redemption.voterReputation + redemption.stakerReputation + redemption.beneficiaryReputation + redemption.proposerReputation;
      });

      redeemAllTip =
        <div>
          {redemptions.length} proposals with rewards waiting:
          <ul>
            {ethReward > 0 ? <li>ETH reward: {ethReward}</li> : ""}
            {nativeReward > 0 ? <li>{dao.tokenSymbol} token reward: {nativeReward}</li> : ""}
            {reputationReward > 0 ? <li>{dao.name} reputation reward: {reputationReward}</li> : ""}
          </ul>
        </div>;
    }

    return(
      <div>
        {redemptions.length > 0
          ? <Tooltip placement="bottom" trigger={["hover"]} overlay={redeemAllTip}>
              <button
                className={css.redeemAllRewardsButton}
                onClick={this.handleClickRedeem.bind(this)}
              >
                Redeem All Rewards
              </button>
            </Tooltip>
          : ""
        }
        <div className={css.proposalsHeader}>
          Proposals with rewards for you to redeem
        </div>
        <div className={css.proposalsContainer}>
          <div className={css.proposalsContainer}>
            {proposalsHTML}
          </div>
        </div>
      </div>
    );
  }

}

export default connect(mapStateToProps, mapDispatchToProps)(DaoRedemptionsContainer);
