import * as React from "react";
import Web3 = require("web3");
import { IProposalState } from "@daostack/client";
import { setIpfsEndpoint, getIdentity, IdentityDefinitionForm, isHuman } from "@dorgtech/id-dao-client";
import * as classNames from "classnames";
import { GenericSchemeInfo } from "genericSchemeRegistry";
// import { getArcSettings } from "arc";
import IdentityDefinitionView from "./IdentityDefinitionView";
import * as css from "../ProposalSummary.scss";
import * as idCss from "./IdentityDefinition.scss";

const hexToAscii = (hex: string) => {
  const web3 = new Web3();
  return web3.utils.hexToAscii(hex);
}

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
    // const ipfsProv = getArcSettings().ipfsProvider;
    // TODO: edit setIpfsEndpoint to take the full struct
    setIpfsEndpoint("localhost");

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
          const hash = hexToAscii(metadata);
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
    const { decodedCallData, identity, updatedIdentity, error } = this.state;
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
      case "add": {
        const [callAddress, callHash, callSig] = decodedCallData.values;

        return (
          <div className={proposalSummaryClass}>
            <span className={css.summaryTitle}>
              <img src="/assets/images/Icon/v-small-line.svg"/>&nbsp;
              {action.label}
            </span>
            { detailView ?
              <div className={css.summaryDetails}>
                <IdentityDefinitionView identity={identity} rootHash={hexToAscii(callHash)}/>
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
      }
      case "update": {
        const [callAddress, callHash, callSig] = decodedCallData.values;

        return (
          <div className={proposalSummaryClass}>
            <span className={css.summaryTitle}>
              <img src="/assets/images/Icon/edit-sm.svg"/>&nbsp;
              {action.label}
            </span>
            { detailView ?
              <div className={css.summaryDetails}>
                <IdentityDefinitionView identity={updatedIdentity} rootHash={hexToAscii(callHash)}/>
                <IdentityDefinitionView identity={identity} rootHash={"TODO"}/>
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
      }
      case "remove": {
        const [callAddress] = decodedCallData.values;

        return (
          <div className={proposalSummaryClass}>
            <span className={css.summaryTitle}>
              <img src="/assets/images/Icon/x-small-line.svg"/>&nbsp;
              {action.label}
            </span>
            { detailView ?
              <div className={css.summaryDetails}>
                <IdentityDefinitionView identity={identity} rootHash={"TODO"}/>
                <div className={idCss.identityProp}>
                  [Expert] Contract Call Values
                </div>
                <div className={idCss.identityValue}>
                  {`id: address - ${callAddress}`}
                </div>
              </div>
              : ""
            }
          </div>
        );
      }
      default:
        return "";
    }
  }
}
