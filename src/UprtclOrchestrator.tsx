import { ethers } from "ethers";
import * as IPFS from "ipfs";

import {
  MicroOrchestrator,
  i18nextBaseModule,
} from "@uprtcl/micro-orchestrator";
import { LensesModule } from "@uprtcl/lenses";
import { DocumentsModule } from "@uprtcl/documents";
import { WikisModule } from "@uprtcl/wikis";

import { CortexModule } from "@uprtcl/cortex";
import { EveesModule } from "@uprtcl/evees";
import { IpfsStore } from "@uprtcl/ipfs-provider";

import {
  EveesOrbitDB,
  EveesOrbitDBModule,
  ProposalsOrbitDB,
} from "@uprtcl/evees-orbitdb";
import { OrbitDBCustom } from "@uprtcl/orbitdb-provider";
import {
  EveesEthereumConnection,
  EthereumOrbitDBIdentity,
} from "@uprtcl/evees-ethereum";
import {
  EveesBlockchainCached,
  EveesBlockchainModule,
} from "@uprtcl/evees-blockchain";

import { EthereumConnection } from "@uprtcl/ethereum-provider";

import { ApolloClientModule } from "@uprtcl/graphql";
import { DiscoveryModule } from "@uprtcl/multiplatform";

import {
  PerspectiveStore,
  ContextStore,
  ProposalStore,
  ProposalsToPerspectiveStore,
  ContextAccessController,
  ProposalsAccessController,
} from "@uprtcl/evees-orbitdb";

type version = 1 | 0;

export const NETWORK_ID = 100;

export default class UprtclOrchestrator {
  orchestrator: MicroOrchestrator;
  config: any;

  constructor() {
    this.config = {};

    const provider = new ethers.providers.JsonRpcProvider(
      "https://rpc.xdaichain.com/"
    );

    this.config.eth = { provider };

    this.config.orbitdb = {
      pinner: {
        url: "http://localhost:3100",
        multiaddr:
          "/ip4/127.0.0.1/tcp/4003/ws/p2p/QmVPfFXZep8ZFUjM5G2QmvMuvNrkNLnBiT3joDUYafrMQi",
      },
    };

    // this.config.ipfs.http = { host: 'localhost', port: 5001, protocol: 'http' };
    this.config.ipfs = {
      cid: {
        version: 1 as version,
        type: "sha2-256",
        codec: "raw",
        base: "base58btc",
      },
      jsIpfs: {
        preload: { enabled: false },
        relay: { enabled: true, hop: { enabled: true, active: true } },
        EXPERIMENTAL: { pubsub: true },
        config: {
          Addresses: {
            Swarm: [
              "/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star/",
              "/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star/",
              "/dns4/webrtc-star.discovery.libp2p.io/tcp/443/wss/p2p-webrtc-star/",
            ],
          },
          Bootstrap: [
            "/ip4/192.168.0.113/tcp/4003/ws/p2p/QmVPfFXZep8ZFUjM5G2QmvMuvNrkNLnBiT3joDUYafrMQi",
            ,
          ],
        },
      },
    };
  }

  async load() {
    this.orchestrator = new MicroOrchestrator();

    const ipfs = await IPFS.create(this.config.ipfs.jsIpfs);

    console.log("connecting to pinner peer");
    await ipfs.swarm.connect(this.config.orbitdb.pinner.multiaddr);
    console.log("connected!!!");

    const ipfsStore = new IpfsStore(
      this.config.ipfs.cid,
      ipfs,
      this.config.orbitdb.pinner.url
    );
    await ipfsStore.ready();

    const ethConnection = new EthereumConnection({
      provider: this.config.eth.provider,
    });
    await ethConnection.ready();
    const identity = new EthereumOrbitDBIdentity(ethConnection);

    const orbitDBCustom = new OrbitDBCustom(
      [
        PerspectiveStore,
        ContextStore,
        ProposalStore,
        ProposalsToPerspectiveStore,
      ],
      [ContextAccessController, ProposalsAccessController],
      identity,
      this.config.orbitdb.pinner.url,
      this.config.orbitdb.pinner.multiaddr,
      ipfs
    );
    await orbitDBCustom.ready();

    const orbitdbEvees = new EveesOrbitDB(orbitDBCustom, ipfsStore);
    await orbitdbEvees.connect();

    const proposals = new ProposalsOrbitDB(orbitDBCustom, ipfsStore);

    const ethEveesConnection = new EveesEthereumConnection(ethConnection);
    await ethEveesConnection.ready();

    const ethEvees = new EveesBlockchainCached(
      ethEveesConnection,
      orbitDBCustom,
      ipfsStore,
      proposals,
      "ethereum-evees-cache"
    );
    await ethEvees.ready();

    const evees = new EveesModule([orbitdbEvees, ethEvees]);

    const documents = new DocumentsModule();
    const wikis = new WikisModule();

    const modules = [
      new i18nextBaseModule(),
      new ApolloClientModule(),
      new CortexModule(),
      new DiscoveryModule([ipfsStore.casID]),
      new LensesModule(),
      new EveesBlockchainModule(),
      new EveesOrbitDBModule(),
      evees,
      documents,
      wikis,
    ];

    try {
      await this.orchestrator.loadModules(modules);
    } catch (e) {
      console.error(e);
    }
  }

  private static _instance: UprtclOrchestrator;

  public static getInstance(config?: any) {
    return this._instance || (this._instance = new this());
  }
}
