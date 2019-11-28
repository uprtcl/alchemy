import * as React from "react";
import { ContentSource } from "@dorgtech/id-dao-client";
import { getIPFS } from "@dorgtech/id-dao-client/dist/utils/ipfsUtils";
import * as Hls from "hls.js";
import * as HlsjsIpfsLoader from "hlsjs-ipfs-loader";

interface IProps {
  source: ContentSource;
}

interface IState {
  supported: boolean;
}

export default class Video extends React.Component<IProps, IState> {
  hls = new Hls();
  videoEl = React.createRef<HTMLVideoElement>();

  constructor(props: IProps) {
    super(props);
    Hls.DefaultConfig.loader = HlsjsIpfsLoader
    Hls.DefaultConfig.debug = false;

    this.state = {
      supported: Hls.isSupported()
    };

    if (Hls.isSupported()) {
      const { hls, videoEl } = this;
      const hash = this.props.source.hash;

      // TODO: get this to work!

      // @ts-ignore
      hls.config.ipfs = getIPFS();
      // @ts-ignore
      hls.config.ipfs.ls(hash).then((res) => console.log(res));
      // @ts-ignore
      hls.config.ipfsHash = hash;
      hls.loadSource("master.m3u8");
      hls.attachMedia(videoEl.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoEl.current.play();
      });
    }
  }

  render(): RenderOutput {
    const { supported } = this.state;

    return supported ?
      <video ref={this.videoEl} controls /> :
      <div>Video Playback Unsupported</div>;
  }
}
