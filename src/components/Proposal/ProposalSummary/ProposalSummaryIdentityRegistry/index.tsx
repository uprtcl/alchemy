import * as React from "react";
import Web3 = require("web3");
import { TwitterTweetEmbed } from "react-twitter-embed";
import Gist from "react-gist";
import { IProposalState } from "@daostack/client";
import { setIpfsEndpoint, getIdentity, IdentityDefinitionForm, isHuman } from "@dorgtech/id-dao-client";
import * as classNames from "classnames";
import { GenericSchemeInfo } from "genericSchemeRegistry";
import { getArcSettings } from "arc";
import Selfie from "./Selfie";
import * as css from "../ProposalSummary.scss";
import * as idCss from "./IdentityDefinition.scss";

interface IProps {
  genericSchemeInfo: GenericSchemeInfo;
  detailView?: boolean;
  proposal: IProposalState;
  transactionModal?: boolean;
}

interface IState {
  decodedCallData: any;
  identity: IdentityDefinitionForm;
  updatedIdentity: IdentityDefinitionForm;
  error: string;
}

export default class ProposalSummaryIdentityRegistry extends React.Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      decodedCallData: { action: {} },
      identity: new IdentityDefinitionForm(),
      updatedIdentity: new IdentityDefinitionForm(),
      error: ""
    }
  }

  async componentDidMount() {
    setIpfsEndpoint(getArcSettings().ipfsProvider);

    const { proposal, genericSchemeInfo } = this.props;
    let decodedCallData: any;
    try {
      decodedCallData = genericSchemeInfo.decodeCallData(proposal.genericScheme.callData);
      this.setState({
        decodedCallData
      });
    } catch(err) {
      this.setState({ error: err.message });
      return;
    }
    const action = decodedCallData.action;

    const validateAddresses = (targetAddress: string, definedAddress: string) => {
      if (targetAddress.toLowerCase() !== definedAddress.toLowerCase()) {
        this.setState({
          error:
          "Address Mismatch - Please ensure the address in the" +
          " Identity Definition matches the address you're proposing the definition for." +
          `Expected - ${targetAddress} ` +
          `Requested - ${definedAddress}`
        });
        return true;
      }
      return false;
    }

    switch (action.id) {
      case "add": {
        const [id, metadata] = decodedCallData.values;
        try {
          const web3 = new Web3();
          const hash = web3.utils.hexToAscii(metadata);
          const identity = await getIdentity({ hash });
          const form = new IdentityDefinitionForm();
          form.data = identity;
          await form.validate();

          if (validateAddresses(id, identity.address)) {
            return;
          }

          this.setState({
            identity: form
          });
        } catch (err) {
          this.setState({
            error: `Failed To Get Identity - ${err.message}`
          });
        }
        break;
      }
      case "update": {
        const [id, metadata] = decodedCallData.values;
        try {
          // verify this id is already in the registry
          try {
            if (await isHuman(id) === false) {
              this.setState({
                error: `Cannot update an identity that's not in the registry.`
              });
              return;
            }
          } catch (err) {
            this.setState({
              error: `Failed to interact with the Identity Registry...\n${err.message}`
            });
            return;
          }

          // fetch the proposed "updated identity"
          const web3 = new Web3();
          const hash = web3.utils.hexToAscii(metadata);
          const updatedIdentity = await getIdentity({ hash });
          const updatedForm = new IdentityDefinitionForm();
          updatedForm.data = updatedIdentity;
          await updatedForm.validate();

          if (validateAddresses(id, updatedIdentity.address)) {
            return;
          }

          // fetch the current identity from the registry
          const identity = await getIdentity({ address: id });
          const form = new IdentityDefinitionForm();
          form.data = identity;
          await form.validate();

          this.setState({
            identity: form,
            updatedIdentity: updatedForm
          });
        } catch (err) {
          this.setState({
            error: `Failed To Get Identity - ${err.message}`
          });
        }
        break;
      }
      case "remove": {
        const [id] = decodedCallData.values;
        try {
          const identity = await getIdentity({ address: id });
          const form = new IdentityDefinitionForm();
          form.data = identity;

          this.setState({
            identity: form
          });
        } catch (err) {
          this.setState({
            error: `Failed to interact with the Identity Registry...\n${err.message}`
          });
        }
        break;
      }
    }
  }

  public render(): RenderOutput {
    const { detailView, transactionModal } = this.props;
    const { decodedCallData, identity, error } = this.state;
    const action = decodedCallData.action;

    const proposalSummaryClass = classNames({
      [css.detailView]: detailView,
      [css.transactionModal]: transactionModal,
      [css.proposalSummary]: true,
      [css.withDetails]: true,
    });

    if (error) {
      if (action) {
        return (
          <div className={proposalSummaryClass}>
            <span className={css.summaryTitle}>
              <img src="/assets/images/Icon/edit-sm.svg"/>&nbsp;
              {action.label}
            </span>
            {detailView ?
              <div>Error: {error}</div> :
              <div> Error Found...</div>
            }
          </div>
        );
      } else {
        return detailView ?
            <div>Error: {error}</div> :
            <div> Error Found...</div>;
      }
    }

    switch (action.id) {
      case "add":

        // Show address
        // fetch metadata from IPFS
        // Render Metadata
        // Big red sign if metadata.address !== params.address

        // render twitter
        // render github
        // render image
        // render video

        const [callAddress, callHash, callSig] = decodedCallData.values;
        const id = identity.data;

        const extractTweetId = (url: string) => {
          const lastSlash = url.lastIndexOf('/');
          return url.substr(lastSlash + 1);
        }

        const extractGistId = (url: string) => {
          const lastSlash = url.lastIndexOf('/');
          return url.substr(lastSlash + 1);
        }

        return (
          <div className={proposalSummaryClass}>
            <span className={css.summaryTitle}>
              <img src="/assets/images/Icon/edit-sm.svg"/>&nbsp;
              {action.label}
            </span>
            { detailView ?
              <div className={css.summaryDetails}>
                <div className={idCss.identityProp}>
                  Name
                </div>
                <div className={idCss.identityError}>
                  {identity.$.name.error}
                </div>
                <div className={idCss.identityValue}>
                  {id.name}
                </div>
                <div className={idCss.identityProp}>
                  Address
                </div>
                <div className={idCss.identityError}>
                  {identity.$.address.error}
                </div>
                <div className={idCss.identityValue}>
                  {id.address}
                </div>
                <div className={idCss.identityProp}>
                  Selfie
                </div>
                <div className={idCss.identityError}>
                  {identity.$.uploads.$.selfie.error}
                </div>
                {identity.$.uploads.$.selfie.hasError === false ?
                  (id.uploads.selfie ?
                    <Selfie source={id.uploads.selfie} /> :
                    <></>
                  ) :
                  <></>
                }
                <div className={idCss.identityProp}>
                  Twitter
                </div>
                <div className={idCss.identityError}>
                  {identity.$.socialPosts.$.twitter.error}
                </div>
                {identity.$.socialPosts.$.twitter.error === undefined ?
                  (id.socialPosts.twitter ?
                    <TwitterTweetEmbed tweetId={extractTweetId(id.socialPosts.twitter)} /> :
                    <></>
                  ) :
                  <></>
                }
                <div className={idCss.identityProp}>
                  Twitter
                </div>
                <div className={idCss.identityError}>
                  {identity.$.socialPosts.$.twitter.error}
                </div>
                {identity.$.socialPosts.$.github.error === undefined ?
                  (id.socialPosts.github ?
                    <Gist id={extractGistId(id.socialPosts.github)} /> :
                    <></>
                  ) :
                  <></>
                }
                <div className={idCss.identityProp}>
                  [Expert] Identity Definition JSON
                </div>
                <div className={idCss.identityValue}>
                  <p>
                    {JSON.stringify(identity.data, null, 2)}
                  </p>
                </div>
                <div className={idCss.identityProp}>
                  [Expert] Contract Call Values
                </div>
                <div className={idCss.identityValue}>
                  {`id: address - ${callAddress}`}
                </div>
                <div className={idCss.identityValue}>
                  {`metadata: bytes - ${callHash}`}
                </div>
                <div className={idCss.identityValue}>
                  {`sig: bytes - ${callSig}`}
                </div>
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
