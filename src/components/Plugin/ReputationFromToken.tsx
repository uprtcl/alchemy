import { Address, IPluginState, ReputationFromTokenPlugin, Token } from "@daostack/arc.js";
import axios from "axios";
import { getArcSettings } from "arc";
import { utils } from "ethers";
import { soliditySHA3 } from "ethereumjs-abi";
import { parse } from "query-string";
import { RouteComponentProps } from "react-router-dom";
import { NotificationStatus } from "reducers/notifications";
import { redeemReputationFromToken } from "actions/arcActions";
import { enableWalletProvider, getArc } from "arc";
import { ErrorMessage, Field, Form, Formik, FormikProps } from "formik";
import { fromWei, isAddress } from "lib/util";
import { pluginName } from "lib/pluginUtils";
import * as React from "react";
import { BreadcrumbsItem } from "react-breadcrumbs-dynamic";
import * as Sticky from "react-stickynode";
import { connect } from "react-redux";
import { IRootState } from "reducers";
import { showNotification } from "reducers/notifications";
import * as pluginCss from "./Plugin.scss";
import * as css from "./ReputationFromToken.scss";

import BN = require("bn.js");

interface IExternalProps extends RouteComponentProps<any> {
  daoAvatarAddress: Address;
  pluginState: IPluginState;
}

interface IStateProps {
  currentAccountAddress: Address;
}

interface IDispatchProps {
  redeemReputationFromToken: typeof redeemReputationFromToken;
  showNotification: typeof showNotification;
}

const mapDispatchToProps = {
  redeemReputationFromToken,
  showNotification,
};

type IProps = IExternalProps & IStateProps & IDispatchProps;

const mapStateToProps = (state: IRootState, ownProps: IExternalProps): IExternalProps & IStateProps => {
  return {...ownProps,
    currentAccountAddress: state.web3.currentAccountAddress,
  };
};

interface IState {
  redemptionAmount: BN;
  alreadyRedeemed: boolean;
  privateKey: string;
  redeemerAddress: Address;
}

interface IFormValues {
  accountAddress: string;
  useTxSenderService: boolean;
}

class ReputationFromToken extends React.Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.handleSubmit = this.handleSubmit.bind(this);
    let redeemerAddress: Address;
    const queryValues = parse(this.props.location.search);
    let pk = queryValues["pk"] as string;
    if (pk) {
      if (!pk.startsWith("0x")) {
        pk = `0x${pk}`;
      }
      try {
        redeemerAddress = new utils.SigningKey(pk).publicKey;
      } catch (err) {
        throw Error(`Invalide private key: ${pk}`);
      }
    } else {
      redeemerAddress = this.props.currentAccountAddress;
    }


    this.state = {
      redemptionAmount: new BN(0),
      alreadyRedeemed: false,
      privateKey: pk,
      redeemerAddress,
    };
  }

  private async _loadReputationBalance(redeemerAddress: string) {
    if (redeemerAddress) {
      const pluginState = this.props.pluginState;
      const pluginAddress = pluginState.address;
      const arc = getArc();
      const pluginContract = await arc.getContract(pluginAddress);
      const tokenContractAddress = await pluginContract.methods.tokenContract().call();
      const tokenContract = new Token(arc, tokenContractAddress);
      const balance = new BN(await tokenContract.contract().methods.balanceOf(redeemerAddress).call());
      const alreadyRedeemed = await pluginContract.methods.redeems(redeemerAddress).call();
      let redemptionAmount;
      if (alreadyRedeemed) {
        redemptionAmount = new BN(0);
      } else {
        redemptionAmount = balance;
      }
      this.setState({
        redemptionAmount,
        alreadyRedeemed,
        redeemerAddress,
      });
    } else {
      this.setState({
        redemptionAmount: new BN(0),
        alreadyRedeemed: false,
        redeemerAddress: null,
      });
    }
  }

  public async componentDidMount() {
    await this._loadReputationBalance(this.state.redeemerAddress);
  }

  public async componentDidUpdate(prevProps: IProps) {
    if (!this.state.privateKey && this.props.currentAccountAddress !== prevProps.currentAccountAddress) {
      await this._loadReputationBalance(this.props.currentAccountAddress);
    }
  }

  public async handleSubmit(values: IFormValues, { _props, setSubmitting, _setErrors }: any): Promise<void> {
    // only connect to wallet if we do not have a private key to sign with
    if (!this.state.privateKey &&
      !await enableWalletProvider({ showNotification: this.props.showNotification })) {
      setSubmitting(false);
      return;
    }

    const pluginState = this.props.pluginState;
    const pluginAddress = pluginState.address;
    const arc = getArc();
    const pluginContract = await arc.getContract(pluginAddress);
    const alreadyRedeemed = await pluginContract.methods.redeems(this.state.redeemerAddress).call();
    if (alreadyRedeemed) {
      this.props.showNotification(NotificationStatus.Failure, `Reputation for the account ${this.state.redeemerAddress} was already redeemed`);
      this.redemptionSucceeded();
    } else if (values.useTxSenderService === true) {
      // construct the message to sign
      // const signatureType = 1
      const messageToSign = "0x"+ soliditySHA3(
        ["address", "address"],
        [pluginAddress, values.accountAddress]
      ).toString("hex");

      // console.log(`Sign this message of type ${signatureType}: ${messageToSign}`)
      // const text = `Please sign this message to confirm your request to redeem reputation.
      //     There's no gas cost to you.`
      const method = "personal_sign";

      // Create promise-based version of send
      const params = [messageToSign, this.props.currentAccountAddress];
      let result;

      try {
        result = await arc.web3.send(method, params);
      } catch (err) {
        this.props.showNotification(NotificationStatus.Failure, "The redemption was canceled");
        setSubmitting(false);
        return;
      }
      if (result.error) {
        this.props.showNotification(NotificationStatus.Failure, "The redemption was canceled");
        setSubmitting(false);
        return;
      }
      let signature = result.result;
      const signature1 = signature.substring(0, signature.length-2);
      const v = signature.substring(signature.length-2, signature.length);
      if (v === "00") {
        signature = signature1+"1b";
      } else {
        signature = signature1+"1c";
      }
      const signatureType = 1;
      const contract = arc.getContract(pluginState.address);

      // send the transaction and get notifications
      if (contract) {
        // more information on this service is here: https://github.com/dOrgTech/TxPayerService
        const txServiceUrl = getArcSettings().txSenderServiceUrl;
        const data = {
          to: pluginState.address,
          methodAbi: {
            "constant": false,
            "inputs": [
              {
                "internalType": "address",
                "name": "_beneficiary",
                "type": "address",
              },
              {
                "internalType": "uint256",
                "name": "_signatureType",
                "type": "uint256",
              },
              {
                "internalType": "bytes",
                "name": "_signature",
                "type": "bytes",
              },
            ],
            "name": "redeemWithSignature",
            "outputs": [
              {
                "internalType": "uint256",
                "name": "",
                "type": "uint256",
              },
            ],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function",
          },
          parameters: [values.accountAddress.toLowerCase(), signatureType, signature],
        };
        try {
          this.props.showNotification(NotificationStatus.Success, "Sending the transaction to the payment service -- please be patient");
          const response = await axios(txServiceUrl, {
            method: "post",
            data,
          });
          if (response.data.status !== 200) {
            this.props.showNotification(NotificationStatus.Failure, `An error occurred on the transaction service: ${response.data.status}: ${response.data.message}`);
          } else {
            this.props.showNotification(NotificationStatus.Success, `You've successfully redeemed rep to ${values.accountAddress}`);
            this.redemptionSucceeded();
          }
        } catch (err) {
          this.props.showNotification(NotificationStatus.Failure, `${err.message}}`);
        }
        // const tx = await contract.methods.redeemWithSignature(values.accountAddress.toLowerCase(), signatureType, signature).send(
        //   {from: this.props.currentAccountAddress}
        // )
      } else {
        throw Error("Plugin not found!?!");
      }
      // return (await _testSetup.reputationFromToken.redeemWithSignature(_beneficiary,signatureType,signature
      // ,{from:_fromAccount}));
    } else {
      const plugin = new ReputationFromTokenPlugin(arc, pluginState.id);
      await this.props.redeemReputationFromToken(plugin, values.accountAddress, this.state.privateKey, this.state.redeemerAddress, this.redemptionSucceeded);
    }
    setSubmitting(false);
  }

  public redemptionSucceeded = () => {
    this.setState( { redemptionAmount: new BN(0) });
  }

  private onSubmitClick = (setFieldValue: any) => () => { setFieldValue("useTxSenderService", false); }

  public render(): RenderOutput {
    const { daoAvatarAddress, pluginState, currentAccountAddress } = this.props;
    const redeemerAddress = this.state.redeemerAddress;

    return (
      <div className={pluginCss.pluginContainer}>
        <BreadcrumbsItem to={`/dao/${daoAvatarAddress}/plugin/${pluginState.id}`}>{pluginName(pluginState, pluginState.address)}</BreadcrumbsItem>

        <Sticky enabled top={50} innerZ={10000}>
          <h2 className={pluginCss.pluginName}>
            {pluginName(pluginState, pluginState.address)}
          </h2>
        </Sticky>
        { this.state.alreadyRedeemed ? <div>Reputation for account {redeemerAddress} has already been redeemed</div> : <div /> }
        <div className={pluginCss.pluginRedemptionContainer}>
          <Formik
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            initialValues={{
              accountAddress: currentAccountAddress,
              useTxSenderService: false,
            } as IFormValues}
            // eslint-disable-next-line react/jsx-no-bind
            validate={(values: IFormValues): void => {
              const errors: any = {};

              const require = (name: string) => {
                if (!(values as any)[name]) {
                  errors[name] = "Required";
                }
              };

              require("accountAddress");

              if (!isAddress(values.accountAddress)) {
                errors.otherPlugin = "Invalid address";
              }

              return errors;
            }}

            onSubmit={this.handleSubmit}
            // eslint-disable-next-line react/jsx-no-bind
            render={({
              errors,
              touched,
              setFieldValue,
            }: FormikProps<IFormValues>) => {
              return <Form noValidate>
                <div className={pluginCss.fields}>
                  <h3>{ this.state.redemptionAmount ? fromWei(this.state.redemptionAmount) : "..." } Rep to redeem </h3>
                  <b>Redeem reputation to which account?</b>
                  <div className={pluginCss.redemptionAddress}>
                    <label htmlFor="accountAddressInput">
                      <ErrorMessage name="accountAddress">{(msg: string) => <span className={css.errorMessage}>{msg}</span>}</ErrorMessage>
                    </label>
                    <Field
                      id="accountAddressInput"
                      maxLength={120}
                      placeholder="Account address"
                      name="accountAddress"
                      className={touched.accountAddress && errors.accountAddress ? css.error : null}
                    />
                  </div>
                  <b>⚠️ After redemption, reputation is not transferable</b>
                </div>
                <div className={pluginCss.redemptionButton}>
                  <button type="submit"
                    disabled={this.state.alreadyRedeemed || this.state.redemptionAmount.isZero()}
                    onClick={this.onSubmitClick(setFieldValue)}
                  >
                    <img src="/assets/images/Icon/redeem.svg"/> Redeem
                  </button>
                </div>
                { getArcSettings().txSenderServiceUrl ?
                  <div className={pluginCss.redemptionButton}>
                    <div>Or try our new experimental feature:</div>
                    <button type="submit"
                      disabled={this.state.alreadyRedeemed || this.state.redemptionAmount.isZero()}
                      onClick={this.onSubmitClick(setFieldValue)}
                    >
                      <img src="/assets/images/Icon/redeem.svg"/> Redeem w/o paying gas
                    </button>
                  </div>
                  : null }
              </Form>;
            }}
          />
        </div>
      </div>
    );
  }
}

const ConnectedReputationFromToken = connect(mapStateToProps, mapDispatchToProps)(ReputationFromToken);

export default ConnectedReputationFromToken;
