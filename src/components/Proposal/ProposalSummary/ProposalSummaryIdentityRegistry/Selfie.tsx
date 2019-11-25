import * as React from "react";
import { ContentSource, fetchContent } from "@dorgtech/id-dao-client";
import * as idCss from "./IdentityDefinition.scss";

interface IProps {
  source: ContentSource;
}

interface IState {
  img: string;
  error: string;
}

export default class Selfie extends React.Component<IProps, IState> {

  constructor(props: IProps) {
    super(props);
    this.state = {
      img: "",
      error: ""
    };
  }

  async componentDidMount() {
    try {
      const { source } = this.props;
      const buffer = await fetchContent(source);

      // TODO: This is error prone, we can't assume jpeg.
      // Should we require an extension?
      this.setState({
        img: `data:image/jpeg;base64, ${buffer.toString("base64")}`
      });
    } catch (err) {
      this.setState({
        error: err.message
      });
    }
  }

  public render(): RenderOutput {
    const { img, error } = this.state;
    return (
      <>
      {img === "" ?
        <></> :
        <div className={idCss.selfie}>
          <img src={img} alt={"selfie"} />
        </div>
      }
      {error === "" ?
        <></> :
        <div className={idCss.identityError}>
          {error}
        </div>
      }
      </>
    );
  }
}
