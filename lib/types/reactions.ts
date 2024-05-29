import { SUPPORTED_EMOJIS } from "@/constants/reactions";

export type ReactionType = typeof SUPPORTED_EMOJIS[number];
export type ReactionResponse = {[key in ReactionType]: { count: number, userReacted: boolean } }
