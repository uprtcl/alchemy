import { ethers } from 'ethers';
import * as IPFS from 'ipfs';

import {
  MicroOrchestrator,
  i18nextBaseModule
} from '@uprtcl/micro-orchestrator';
import { LensesModule } from '@uprtcl/lenses';
import { DocumentsModule } from '@uprtcl/documents';
import { WikisModule } from '@uprtcl/wikis';

import { CortexModule } from '@uprtcl/cortex';
import { EveesModule } from '@uprtcl/evees';
import { IpfsStore, PinnerCached } from '@uprtcl/ipfs-provider';

import {
  EveesEthereumConnection,
  EthereumOrbitDBIdentity,
  EveesEthereumModule
} from '@uprtcl/evees-ethereum';
import {
  EveesBlockchainCached,
  EveesBlockchainModule,
  EveesOrbitDBDebugger
} from '@uprtcl/evees-blockchain';

import { HttpEthAuthProvider, HttpStoreCached } from '@uprtcl/http-provider';
import { EveesHttp, EveesHttpModule } from '@uprtcl/evees-http';

import { EthereumConnection } from '@uprtcl/ethereum-provider';

import { ApolloClientModule } from '@uprtcl/graphql';
import { DiscoveryModule } from '@uprtcl/multiplatform';

import {
  EveesOrbitDBModule,
  ProposalsOrbitDB,
  ContextStore,
  ProposalStore,
  ProposalsToPerspectiveStore,
  getContextAcl,
  getProposalsAcl
} from '@uprtcl/evees-orbitdb';
import { OrbitDBCustom, AddressMapping } from '@uprtcl/orbitdb-provider';

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
      'https://xdai.poanetwork.dev/'
    );

    const host = 'https://apps.intercreativity.io:3000';

    // const peerPath = `/dns4/pinner.intercreativity.io/tcp/4003/wss/p2p`;
    const peerPath = `/dns4/localhost/tcp/4003/ws/p2p`;
    const peerId = 'QmcWvt62jXjz3EiF42WfRxkREz2JHSe71hrKjvPzgPN3ux';

    this.config.eth = { provider };

    this.config.http = { host };

    this.config.orbitdb = {
      pinner: {
        // url: 'https://apps.intercreativity.io:3000',
        url: 'http://localhost:3200',
        multiaddr: `${peerPath}/${peerId}`
      }
    };

    // this.config.ipfs.http = { host: 'localhost', port: 5001, protocol: 'http' };
    this.config.ipfs = {
      cid: {
        version: 1 as version,
        type: 'sha2-256',
        codec: 'raw',
        base: 'base58btc'
      },
      jsIpfs: {
        preload: { enabled: false },
        relay: { enabled: true, hop: { enabled: true, active: true } },
        EXPERIMENTAL: { pubsub: true },
        config: {
          Addresses: {
            Swarm: []
          },
          Bootstrap: [`${peerPath}/${peerId}`, ,]
        }
      }
    };
  }

  async load() {
    this.orchestrator = new MicroOrchestrator();

    const ipfs = await IPFS.create(this.config.ipfs.jsIpfs);

    console.log(`${this.config.orbitdb.pinner.multiaddr} connecting...`);
    await ipfs.swarm.connect(this.config.orbitdb.pinner.multiaddr);
    console.log(`${this.config.orbitdb.pinner.multiaddr} connected`);

    console.log('loading ipfs');
    const pinner = new PinnerCached(this.config.orbitdb.pinner.url, 5000);
    const ipfsStore = new IpfsStore(this.config.ipfs.cid, ipfs, pinner);
    await ipfsStore.ready();
    console.log('ipfs ready');

    console.log('loading ethereum connection');
    const ethConnection = new EthereumConnection({
      provider: this.config.eth.provider
    });
    await ethConnection.ready();
    console.log('ethereum connection ready');

    const identity = new EthereumOrbitDBIdentity(ethConnection);
    const identitySources = [identity];

    console.log('loading orbitdb');
    const customStores = [
      ContextStore,
      ProposalStore,
      ProposalsToPerspectiveStore,
      AddressMapping
    ];

    const orbitDBCustom = new OrbitDBCustom(
      customStores,
      [getContextAcl(identitySources), getProposalsAcl(identitySources)],
      identity,
      pinner,
      this.config.orbitdb.pinner.multiaddr,
      ipfs
    );
    await orbitDBCustom.ready();

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

    const httpProvider = new HttpEthAuthProvider(
      { host: this.config.http.host, apiId: 'evees-v1' },
      ethConnection
    );
    const httpStore = new HttpStoreCached(httpProvider, this.config.ipfs.cid);
    const httpEvees = new EveesHttp(httpProvider, httpStore);

    const evees = new EveesModule([httpEvees, ethEvees]);

    const documents = new DocumentsModule();
    const wikis = new WikisModule();

    const modules = [
      new i18nextBaseModule(),
      new ApolloClientModule(),
      new CortexModule(),
      new DiscoveryModule([httpStore.casID]),
      new LensesModule(),
      new EveesBlockchainModule(),
      new EveesOrbitDBModule(),
      new EveesEthereumModule(),
      new EveesHttpModule(),
      evees,
      documents,
      wikis
    ];

    customElements.define('evees-orbitdb-set-debugger', EveesOrbitDBDebugger);

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
