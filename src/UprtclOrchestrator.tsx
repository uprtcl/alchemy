
import {
  MicroOrchestrator,
  i18nextBaseModule,
} from '@uprtcl/micro-orchestrator';

import { LensesModule } from '@uprtcl/lenses';
import { DocumentsModule } from '@uprtcl/documents';
import { WikisModule } from '@uprtcl/wikis'; 
import { CortexModule } from '@uprtcl/cortex';
import { AccessControlModule } from '@uprtcl/access-control';
import { EveesModule, EveesEthereum, EveesHttp } from '@uprtcl/evees';
import { IpfsStore } from '@uprtcl/ipfs-provider';

import { HttpConnection, HttpStore } from '@uprtcl/http-provider';

import { EthereumConnection } from '@uprtcl/ethereum-provider';

import { ApolloClientModule } from '@uprtcl/graphql';
import { DiscoveryModule, CidConfig } from '@uprtcl/multiplatform';

type version = 1 | 0;

export default class UprtclOrchestrator {

  orchestrator: MicroOrchestrator;
  httpEvees: EveesHttp;
  ethEvees: EveesEthereum;
  evees: EveesModule;
  documents: DocumentsModule;
  wikis: WikisModule;

  constructor() {
    const host = 'https://api.intercreativity.io/uprtcl/1';
    //const host = 'http://localhost:3100/uprtcl/1'

    const ethHost = '';

    const httpCidConfig: CidConfig = {
      version: 1,
      type: 'sha3-256',
      codec: 'raw',
      base: 'base58btc',
    };

    const ipfsConfig = {
      host: 'ipfs.intercreativity.io',
      port: 443,
      protocol: 'https',
    };

    const ipfsCidConfig = {
      version: 1 as version,
      type: 'sha2-256',
      codec: 'raw',
      base: 'base58btc',
    };

    this.orchestrator = new MicroOrchestrator();

    const httpConnection = new HttpConnection();
    const ethConnection = new EthereumConnection({ provider: ethHost });

    const httpStore = new HttpStore(host, httpConnection, httpCidConfig);
    this.httpEvees = new EveesHttp(
      host,
      httpConnection,
      ethConnection,
      httpStore,
    );

    const ipfsStore = new IpfsStore(ipfsConfig, ipfsCidConfig);
    this.ethEvees = new EveesEthereum(
      ethConnection,
      ipfsStore,
      this.orchestrator.container
    )

    this.evees = new EveesModule([this.ethEvees, this.httpEvees], this.httpEvees);
    this.documents = new DocumentsModule();
    this.wikis = new WikisModule();
  }

  async load() {
    const modules = [
      new i18nextBaseModule(),
      new ApolloClientModule(),
      new CortexModule(),
      new DiscoveryModule([this.httpEvees.casID]),
      new LensesModule(),
      new AccessControlModule(),
      this.evees,
      this.documents,
      this.wikis,
    ];

    try {
      await this.orchestrator.loadModules(modules);
    } catch (e) {
      console.error(e);
    }
  }

  private static _instance: UprtclOrchestrator;

  public static getInstance() {
    return (
      this._instance || (this._instance = new this())
    )
  }
  
}




