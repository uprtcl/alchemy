import { IDAOState } from "@daostack/arc.js";
import * as React from "react";
import * as css from "./DaoLandingPage.scss";
import { Page } from "pages";
import Analytics from "lib/analytics";
import { Link } from "react-router-dom";
import { BreadcrumbsItem } from "react-breadcrumbs-dynamic";
import { DiscussionEmbed } from "disqus-react";

type IExternalProps = {
  daoState: IDAOState;
};

interface IStateProps {
  showingEditPagePopup: boolean;
}

type IProps = IExternalProps;

export default class DaoLandingPage extends React.Component<IProps, IStateProps> {

  private disqusConfig: any;

  constructor(props: IProps) {
    super(props);
    this.state = {
      showingEditPagePopup: false,
    };
  }

  public componentDidMount() {
    this.disqusConfig = {
      url: process.env.BASE_URL + "/dao/" + this.props.daoState.address + "/discussion",
      identifier: this.props.daoState.address,
      title: "Discuss " + this.props.daoState.name,
    };

    Analytics.track("Page View", {
      "Page Name": Page.DAOLanding,
      "DAO Address": this.props.daoState.id,
      "DAO Name": this.props.daoState.name,
    });
  }

  public render() {
    const daoState = this.props.daoState;

    return (
      <div className={css.landingPage}>

        <BreadcrumbsItem to={"/dao/" + daoState.address}>{daoState.name}</BreadcrumbsItem>

        <div className={css.infoContainer}>
          <div className={css.titleContainer}>
            <div className={css.row}>
              <div className={css.headerText}>DXdao Voting Dapp</div>
            </div>
          </div>

          <div className={css.welcome}>Welcome to DXdao voting dapp, a decentralized organization built focused on DEFI.</div>
          
          <div className={css.visitProposals}>Visit the <Link to={`/dao/${daoState.id}/schemes/`}>Proposals section</Link> vote or make a new proposal.</div>
          
          <div className={css.visitProposals}>Visit the <Link to={`/dao/${daoState.id}/schemes/`}>History section</Link> To see past proposals information and result.</div>
          
          <div className={css.visitProposals}>Visit the <Link to={`/dao/${daoState.id}/schemes/`}>Members section</Link> To see all DXdao members.</div>
        </div>

        <div className={css.wallContainer}>
          <div className={css.headerText}>Discuss DXdao</div>
          <DiscussionEmbed shortname={process.env.DISQUS_SITE} config={this.disqusConfig} />
        </div>

        
      </div>
    );
  }
}
