import {
  AmmMarket,
  AmmMarketFetchRequest,
  MarketFetchRequest,
  OpenbookMarket,
  OpenbookMarketFetchRequest,
  Order
} from "@/types";
import { FutarchyMarketsClient } from "@/client";
import { FutarchyIndexerOpenbookMarketsClient } from "./market-clients/openbookMarkets";
import { FutarchyOpenbookMarketsRPCClient } from "../rpc/market-clients/openbookMarkets";
import { FutarchyIndexerAmmMarketsClient } from "./market-clients/ammMarkets";
import { FutarchyAmmMarketsRPCClient } from "../rpc";
import { PublicKey } from "@solana/web3.js";
import { Observable } from "rxjs";
import { SpotObservation, TwapObservation } from "@/types/prices";
import {
  generateSubscriptionOp,
  orders_bool_exp,
  orders_order_by,
  orders_select_column
} from "./__generated__";
import { Client as GQLWebSocketClient } from "graphql-ws";
import { FutarchyMarketsRPCClient } from "../rpc/markets";

export class FutarchyIndexerMarketsClient implements FutarchyMarketsClient {
  public openbook: FutarchyIndexerOpenbookMarketsClient;
  public amm: FutarchyIndexerAmmMarketsClient;
  public rpcClient: FutarchyMarketsRPCClient;
  private graphqlWSClient: GQLWebSocketClient;

  constructor(
    rpcOpenbookMarketsClient: FutarchyOpenbookMarketsRPCClient,
    rpcAmmMarketsClient: FutarchyAmmMarketsRPCClient,
    marketsClient: FutarchyMarketsRPCClient,
    graphqlWSClient: GQLWebSocketClient
  ) {
    this.openbook = new FutarchyIndexerOpenbookMarketsClient(
      rpcOpenbookMarketsClient
    );
    this.amm = new FutarchyIndexerAmmMarketsClient(rpcAmmMarketsClient);
    this.rpcClient = marketsClient;
    this.graphqlWSClient = graphqlWSClient;
  }

  async fetchMarket(
    request: MarketFetchRequest
  ): Promise<OpenbookMarket | AmmMarket | undefined> {
    if (request instanceof OpenbookMarketFetchRequest) {
      return this.openbook.fetchMarket(request);
    }
    if (request instanceof AmmMarketFetchRequest) {
      return this.amm.fetchMarket(request);
    }
    return;
  }

  watchTwapPrices(marketKey: PublicKey): Observable<TwapObservation[]> {
    const { query, variables } = generateSubscriptionOp({
      twaps: {
        __args: {
          where: {
            market_acct: { _eq: marketKey.toString() }
          },
          order_by: [
            {
              created_at: "asc"
            }
          ]
        },
        token_amount: true,
        updated_slot: true,
        created_at: true
      }
    });

    return new Observable((subscriber) => {
      const subscriptionCleanup = this.graphqlWSClient.subscribe<{
        twaps: {
          token_amount: number;
          updated_slot: number;
          created_at: Date;
        }[];
      }>(
        { query, variables },
        {
          next: (data) => {
            const twapObservations = data.data?.twaps?.map<TwapObservation>(
              (d) => ({
                price: d.token_amount,
                slot: d.updated_slot,
                createdAt: d.created_at
              })
            );
            subscriber.next(twapObservations ?? []);
          },
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete()
        }
      );

      return () => subscriptionCleanup();
    });
  }

  private watchOrdersForArgs(args: {
    distinct_on?: orders_select_column[] | null | undefined;
    limit?: number | null | undefined;
    offset?: number | null | undefined;
    order_by?: orders_order_by[] | null | undefined;
    where?: orders_bool_exp | null | undefined;
  }): Observable<Order[]> {
    const { query, variables } = generateSubscriptionOp({
      orders: {
        __args: args,
        order_time: true,
        is_active: true,
        filled_base_amount: true,
        quote_price: true,
        side: true,
        market_acct: true,
        order_tx_sig: true,
        transaction: {
          failed: true
        },
        market: {
          tokenAcctByBidsTokenAcct: {
            token: {
              decimals: true,
              image_url: true,
              symbol: true,
              name: true,
              mint_acct: true
            }
          },
          token: {
            decimals: true,
            image_url: true,
            symbol: true,
            name: true,
            mint_acct: true
          },
          tokenByQuoteMintAcct: {
            decimals: true,
            image_url: true,
            symbol: true,
            name: true,
            mint_acct: true
          }
        },
        actor_acct: true
      }
    });

    return new Observable((subscriber) => {
      const subscriptionCleanup = this.graphqlWSClient.subscribe<{
        orders: {
          order_time: string;
          is_active: boolean;
          filled_base_amount: number;
          quote_price: number;
          side: string;
          market_acct: string;
          order_tx_sig: string;
          transaction: {
            failed: boolean;
          };
          market: {
            tokenAcctByBidsTokenAcct: {
              token: {
                decimals: string | null;
                image_url: string | null;
                symbol: string | null;
                name: string | null;
                mint_acct: string | null;
              };
            };
            token: {
              decimals: string | null;
              image_url: string | null;
              symbol: string | null;
              name: string | null;
              mint_acct: string | null;
            };
            tokenByQuoteMintAcct: {
              decimals: string | null;
              image_url: string | null;
              symbol: string | null;
              name: string | null;
              mint_acct: string | null;
            };
          };
          actor_acct: string | null;
        }[];
      }>(
        { query, variables },
        {
          next: (data) => {
            const orders = data.data?.orders
              ?.map<Order | undefined>((order) => {
                const token = order.market.token;
                if (
                  !token.mint_acct ||
                  !token.decimals ||
                  !order.actor_acct ||
                  !order.market_acct
                )
                  return;
                return {
                  time: new Date(order.order_time),
                  transactionStatus: order.transaction.failed
                    ? "failed"
                    : "succeeded",
                  status: order.is_active ? "open" : "closed",
                  size: order.filled_base_amount,
                  filled: order.filled_base_amount,
                  market: new PublicKey(order.market_acct),
                  price: order.quote_price,
                  side: order.side === "BID" ? "bid" : "ask",
                  token: {
                    decimals: Number(token.decimals),
                    name: token.name ?? "",
                    publicKey: token.mint_acct ?? "",
                    symbol: token.symbol ?? "",
                    url: token.image_url ?? ""
                  },
                  owner: new PublicKey(order.actor_acct),
                  signature: order.order_tx_sig
                };
              })
              .filter((o): o is Order => Boolean(o));
            subscriber.next(orders ?? []);
          },
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete()
        }
      );
      return () => subscriptionCleanup();
    });
  }

  watchAllUserOrders(owner: PublicKey): Observable<Order[]> {
    return this.watchOrdersForArgs({
      where: {
        actor_acct: { _eq: owner.toBase58() }
      }
    });
  }

  watchUserOrdersForMarket(
    owner: PublicKey,
    marketAcct: PublicKey
  ): Observable<Order[]> {
    return this.watchOrdersForArgs({
      where: {
        actor_acct: { _eq: owner.toBase58() },
        market_acct: { _eq: marketAcct.toBase58() }
      }
    });
  }

  watchSpotPrices(marketKey: PublicKey): Observable<SpotObservation[]> {
    const { query, variables } = generateSubscriptionOp({
      takes: {
        __args: {
          where: {
            market_acct: { _eq: marketKey.toString() }
          },
          order_by: [
            {
              order_time: "asc"
            }
          ]
        },
        order_time: true,

        quote_price: true
      }
    });

    return new Observable((subscriber) => {
      const subscriptionCleanup = this.graphqlWSClient.subscribe<{
        takes: {
          order_time: Date;
          quote_price: number;
        }[];
      }>(
        { query, variables },
        {
          next: (data) => {
            const spotObservations = data.data?.takes?.map<SpotObservation>(
              (d) => ({
                price: d.quote_price,
                createdAt: d.order_time
              })
            );
            subscriber.next(spotObservations ?? []);
          },
          error: (error) => subscriber.error(error),
          complete: () => subscriber.complete()
        }
      );
      return () => subscriptionCleanup();
    });
  }
}
