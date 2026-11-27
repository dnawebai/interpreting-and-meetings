// Adapter entry point for mobile/web hosts. The host supplies its authenticated account store,
// model and retrieval provider. No provider key, document, transcript or memory is bundled.
import { encodeTerm, fidelityPrompt, groundedFindings, recallTerms, researchPrompt, reviewPhrase, type Evidence } from "./interpret-brain.ts";

type Turn = { from: string; to: string; original: string; translation: string };
export interface InterpreterServices {
  memoryEnabled(): Promise<boolean>;
  approvedTerms(): Promise<{content:string}[]>;
  prepareForApproval(note:string): Promise<{id:string;summary:string}>;
  model(system:string, data:unknown): Promise<unknown>;
  retrieve(selection:{term:string}|{documentId:string}): Promise<Evidence[]>;
}
export function interpreterAgents(services:InterpreterServices) {
  return {
    async vocabulary(turn: Turn) {
      return await services.memoryEnabled() ? recallTerms(await services.approvedTerms(),turn.from,turn.to,turn.original) : [];
    },
    async teach(turn: Turn, source:string, target:string) {
      source=source.trim();target=target.trim();
      if (!await services.memoryEnabled() || !source || !target || source.length>150 || target.length>150 || !turn.original.includes(source)) return null;
      return services.prepareForApproval(encodeTerm(turn.from,turn.to,source,target));
    },
    async check(turn:Turn, reader:string) {
      return reviewPhrase(await services.model(fidelityPrompt,{...turn,reader}),turn.original);
    },
    async research(turn:Turn,reader:string,selection:{term:string}|{documentId:string}) {
      const sources=(await services.retrieve(selection)).slice(0,5);
      if(!sources.length)return [];
      const result=await services.model(researchPrompt,{...turn,reader,sources});
      return groundedFindings(result,sources);
    },
  };
}
