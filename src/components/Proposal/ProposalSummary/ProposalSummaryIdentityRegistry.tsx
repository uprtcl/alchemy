import * as React from "react";
import { IProposalState } from "@daostack/client";
import { setIpfsEndpoint, getIdentity, IdentityDefinitionForm } from "@dorgtech/id-dao-client";
import * as classNames from "classnames";
import { GenericSchemeInfo } from "genericSchemeRegistry";
import { getArcSettings } from "arc";
import * as css from "./ProposalSummary.scss";

interface IProps {
  genericSchemeInfo: GenericSchemeInfo;
  detailView?: boolean;
  proposal: IProposalState;
  transactionModal?: boolean;
}

interface State {
  action: any;
  identity: IdentityDefinitionForm;
  id: string;
  sig: string;
}

export default class ProposalSummaryIdentityRegistry extends React.Component<IProps, State> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      action: {},
      identity: new IdentityDefinitionForm(),
      id: "",
      sig: ""
    }
  }
  async componentDidMount() {
    setIpfsEndpoint(getArcSettings().ipfsProvider);

    const { proposal, genericSchemeInfo } = this.props;
    let decodedCallData: any;
    try {
      decodedCallData = genericSchemeInfo.decodeCallData(proposal.genericScheme.callData);
    } catch(err) {
      if (err.message.match(/no action matching/gi)) {
        return <div>Error: {err.message} </div>;
      } else {
        throw err;
      }
    }
    const action = decodedCallData.action;

    this.setState({
      action
    });

    switch (action.id) {
      case "add":
        const [id, metadata, sig] = decodedCallData.values;
        const identity = await getIdentity({ hash: metadata });
        const form = new IdentityDefinitionForm();
        form.data = identity;
        await form.validate();

        this.setState({
          id,
          sig,
          identity: form
        });
      case "update":
      case "remove":
    }
  }

  public render(): RenderOutput {
    const { detailView, transactionModal } = this.props;
    const { action, id, sig, identity } = this.state;

    const proposalSummaryClass = classNames({
      [css.detailView]: detailView,
      [css.transactionModal]: transactionModal,
      [css.proposalSummary]: true,
      [css.withDetails]: true,
    });

    switch (action.id) {
      case "add":

        // Show address
        // fetch metadata from IPFS
        // Render Metadata
        // Big red sign if metadata.address !== params.address

        // render name
        // render address
        // render twitter
        // render github
        // render image
        // render video

        return (
          <div className={proposalSummaryClass}>
            <span className={css.summaryTitle}>
              <img src="/assets/images/Icon/edit-sm.svg"/>&nbsp;
              {action.label}
            </span>
            { detailView ?
              <div className={css.summaryDetails}>
                {id}
                {sig}
                {JSON.stringify(identity.data, null, 2)}
              </div>
              : ""
            }
          </div>
        );
      case "update":
        return (
          <div className={proposalSummaryClass}>
            <span className={css.summaryTitle}>
              <img src="/assets/images/Icon/edit-sm.svg"/>&nbsp;
              {action.label}
            </span>
            { detailView ?
              <div className={css.summaryDetails}>
                
              </div>
              : ""
            }
          </div>
        );
      case "remove":
        return (
          <div className={proposalSummaryClass}>
            <span className={css.summaryTitle}>
              <img src="/assets/images/Icon/edit-sm.svg"/>&nbsp;
              {action.label}
            </span>
            { detailView ?
              <div className={css.summaryDetails}>
                
              </div>
              : ""
            }
          </div>
        );
      default:
        return "";
    }
  }
}
