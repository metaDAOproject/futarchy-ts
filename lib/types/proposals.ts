import { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { AutocratV0 } from "@/idl/autocrat_v0";
import { AutocratV0 as AutocratV0_1 } from "@/idl/autocrat_v0.1";
import { AutocratV0 as AutocratV0_2 } from "@/idl/autocrat_v0.2";
import {
  AccountWithKey,
  MergeWithOptionalFields,
  FutarchyProtocol,
  VaultAccountWithProtocol,
  Dao,
} from "@/types";

export type ProposalInstruction = MergeWithOptionalFields<
  IdlTypes<AutocratV0_2>["ProposalInstruction"],
  MergeWithOptionalFields<
    IdlTypes<AutocratV0_1>["ProposalInstruction"],
    IdlTypes<AutocratV0>["ProposalInstruction"]
  >
>;

export type ProposalAccount = MergeWithOptionalFields<
  IdlAccounts<AutocratV0_2>["proposal"],
  MergeWithOptionalFields<
    IdlAccounts<AutocratV0_1>["proposal"],
    IdlAccounts<AutocratV0>["proposal"]
  >
>;

export type ProposalAccountWithKey = AccountWithKey<ProposalAccount>;

export type ProposalState = "pending" | "executed" | "failed";

// TODO we need to add way more here... this is the problem. This needs to sort of match what the UI needs for the most part
export type Proposal = ProposalAccountWithKey & {
  title: string;
  description: string;
  dao: Pick<Dao, "daoAccount" | "publicKey">;
  protocol: FutarchyProtocol;
  baseVaultAccount: VaultAccountWithProtocol;
  quoteVaultAccount: VaultAccountWithProtocol;
  proposer: GovernanceParticipant;
  content: string;
  state: ProposalState;
  creationDate: Date;
  finalizationDate: Date;
  prices: ProposalPrices;
  volume: number;
  tags: string[];
  participants: GovernanceParticipant[];
  reactions: string[];
};

export type GovernanceParticipant = {
  publicKey: string;
  name?: string;
};

export type ProposalPrices = {
  pass: MarketPrices;
  fail: MarketPrices;
};

export type MarketPrices = {
  spot: number;
  twap?: number;
};
