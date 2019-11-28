import * as React from "react";
import { TwitterTweetEmbed } from "react-twitter-embed";
import Gist from "react-gist";
import { IdentityDefinitionForm } from "@dorgtech/id-dao-client";
import Selfie from "./Selfie";
import Video from "./Video";
import * as idCss from "./IdentityDefinition.scss";

interface IProps {
  identity: IdentityDefinitionForm;
  rootHash: string;
}

export default class IdentityDefinitionView extends React.Component<IProps> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      error: ""
    };
  }

  async componentDidMount() {
    await this.props.identity.validate();
    this.forceUpdate();
  }

  public render(): RenderOutput {
    const { identity, rootHash } = this.props;
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
      <>
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
          Video
        </div>
        <div className={idCss.identityError}>
          {identity.$.uploads.$.video.error}
        </div>
        {identity.$.uploads.$.video.hasError === false ?
          (id.uploads.video ?
            <Video source={id.uploads.video} /> :
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
            <>
              <a target="_blank" href={id.socialPosts.twitter}>View</a>
              <TwitterTweetEmbed tweetId={extractTweetId(id.socialPosts.twitter)} />
            </> :
            <></>
          ) :
          <></>
        }
        <div className={idCss.identityProp}>
          GitHub
        </div>
        <div className={idCss.identityError}>
          {identity.$.socialPosts.$.github.error}
        </div>
        {identity.$.socialPosts.$.github.error === undefined ?
          (id.socialPosts.github ?
            <>
              <a target="_blank" href={id.socialPosts.github}>View</a>
              <Gist id={extractGistId(id.socialPosts.github)} />
            </> :
            <></>
          ) :
          <></>
        }
        <div className={idCss.identityProp}>
          JSON
        </div>
        <div className={idCss.identityValue}>
          <p>
            Root Hash: {rootHash}
          </p>
          <p>
            {JSON.stringify(identity.data, null, 2)}
          </p>
        </div>
      </>
    )
  }
}