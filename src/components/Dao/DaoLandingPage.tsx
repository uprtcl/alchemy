import { IDAOState } from "@daostack/arc.js";
import * as React from "react";
import * as css from "./DaoLandingPage.scss";
import daoConfig from "../../DAOConfig";

import { Link } from "react-router-dom";

type IExternalProps = {
  daoState: IDAOState;
};

type IProps = IExternalProps;

export default class DaoLandingPage extends React.Component<IProps> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      showingEditPagePopup: false,
    };
  }

  public render() {
    const daoState = this.props.daoState;

    return (
      <div className={css.landingPage}>

        <div className={css.infoContainer}>
          <div className={css.titleContainer}>
            <div className={css.row}>
              <div className={css.headerText}>{daoConfig.daoName} Voting Dapp</div>
            </div>
          </div>

          <div className={css.welcome}>Welcome to {daoConfig.daoName} voting dapp, a decentralized organization built focused on DEFI.</div>
          
          <div className={css.visitProposals}>Visit the <Link to={`/dao/${daoState.id}/schemes`}>Proposals section</Link> vote or make a new proposal.</div>
          
          <div className={css.visitProposals}>Visit the <Link to={`/dao/${daoState.id}/history`}>History section</Link> To see past proposals information and result.</div>
          
          <div className={css.visitProposals}>Visit the <Link to={`/dao/${daoState.id}/members`}>Members section</Link> To see all {daoConfig.daoName} members.</div>
        </div>
        
      </div>
    );
  }
}
