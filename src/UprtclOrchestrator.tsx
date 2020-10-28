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
  EveesOrbitDB,
  EveesOrbitDBModule,
  ProposalsOrbitDB,
  PerspectiveStore,
  ContextStore,
  ProposalStore,
  ProposalsToPerspectiveStore,
  getContextAcl,
  getProposalsAcl
} from "@uprtcl/evees-orbitdb";
import { OrbitDBCustom, AddressMapping } from "@uprtcl/orbitdb-provider";

type version = 1 | 0;

export const NETWORK_ID = 100;

export default class UprtclOrchestrator {
  orchestrator: MicroOrchestrator;
  config: any;

  constructor() {
    this.config = {};

    // const provider = new ethers.providers.JsonRpcProvider(
    //   "https://rpc.xdaichain.com/"
    // );

    const provider = new ethers.providers.JsonRpcProvider(
      "https://xdai.poanetwork.dev/"
    );
    const peerPath = `/dns4/ec2-3-89-205-204.compute-1.amazonaws.com/tcp/4003/ws/p2p`;
    const peerId = 'QmetdpjRspEHdfQKR8sFGTf54NHFHbpAMWz3wBhzjSDaF5';

    this.config.eth = { provider };

    this.config.orbitdb = {
      pinner: {
        url: "http://ec2-3-89-205-204.compute-1.amazonaws.com:3000",
        multiaddr:
        `${peerPath}/${peerId}`,
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
              "/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star/"
            ],
          },
          Bootstrap: [
            `${peerPath}/${peerId}`,
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
    console.log(`connected to ${this.config.orbitdb.pinner.multiaddr}`);

    console.log("loading ipfs");
    const ipfsStore = new IpfsStore(
      this.config.ipfs.cid,
      ipfs,
      this.config.orbitdb.pinner.url
    );
    await ipfsStore.ready();
    console.log("ipfs ready");

    console.log("loading ethereum connection");
    const ethConnection = new EthereumConnection({
      provider: this.config.eth.provider,
    });
    await ethConnection.ready();
    console.log("ethereum connection ready");

    const identity = new EthereumOrbitDBIdentity(ethConnection);
    const identitySources = [identity];

    console.log("loading orbitdb");
    const customStores = [
      PerspectiveStore,
      ContextStore,
      ProposalStore,
      ProposalsToPerspectiveStore,
      AddressMapping
    ];

    const orbitDBCustom = new OrbitDBCustom(
      customStores,
      [getContextAcl(identitySources), getProposalsAcl(identitySources)],
      identity,
      this.config.orbitdb.pinner.url,
      this.config.orbitdb.pinner.multiaddr,
      ipfs
    );
    await orbitDBCustom.ready();

    const orbitdbEvees = new EveesOrbitDB(orbitDBCustom, ipfsStore);
    await orbitdbEvees.connect();
    console.log("orbitdb ready");

    const proposals = new ProposalsOrbitDB(orbitDBCustom, ipfsStore);

    const ethEveesConnection = new EveesEthereumConnection(ethConnection);
    await ethEveesConnection.ready();

    const ethEvees = new EveesBlockchainCached(
      ethEveesConnection,
      orbitDBCustom,
      ipfsStore,
      proposals
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
