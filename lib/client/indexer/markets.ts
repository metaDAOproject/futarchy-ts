import { MarketFetchRequest, OpenbookMarketFetchRequest } from "@/types";
import { FutarchyMarketsClient } from "@/client";
import { FutarchyIndexerOpenbookMarketsClient } from "./market-clients/openbookMarkets";
import { FutarchyOpenbookMarketsRPCClient } from "../rpc/market-clients/openbookMarkets";
import { FutarchyIndexerAmmMarketsClient } from "./market-clients/ammMarkets";
import { FutarchyAmmMarketsRPCClient } from "../rpc";

export class FutarchyIndexerMarketsClient implements FutarchyMarketsClient {
  public openbook: FutarchyIndexerOpenbookMarketsClient;
  public amm: FutarchyIndexerAmmMarketsClient;

  constructor(
    rpcOpenbookMarketsClient: FutarchyOpenbookMarketsRPCClient,
    rpcAmmMarketsClient: FutarchyAmmMarketsRPCClient
  ) {
    this.openbook = new FutarchyIndexerOpenbookMarketsClient(
      rpcOpenbookMarketsClient
    );
    this.amm = new FutarchyIndexerAmmMarketsClient(rpcAmmMarketsClient);
  }

  async fetchMarket(request: MarketFetchRequest) {
    if (request instanceof OpenbookMarketFetchRequest) {
      return this.openbook.fetchMarket(request);
    }
    return;
  }
}
