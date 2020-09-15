import { IDAOState } from "@daostack/arc.js";
import * as React from "react";
import * as css from "./DaoLandingPage.scss";

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
      return(
        <div className={css.landingPage}>
          <iframe src="http://dxdao.eth.link/">
          </iframe>
        </div>
      )
  }
}
