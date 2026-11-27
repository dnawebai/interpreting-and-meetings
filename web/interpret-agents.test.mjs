import test from "node:test";
import assert from "node:assert/strict";
import { interpreterAgents } from "./interpret-agents.ts";
import { encodeTerm, recallTerms, groundedFindings } from "./interpret-brain.ts";
import { roomKey,base64,seal,unseal } from "./interpret-room.ts";
test("personal terms respect direction, words and account switch", async()=>{
  const memory=[{content:encodeTerm("en","uk","rent","оренда")}];
  assert.deepEqual(recallTerms(memory,"en","uk","rent is due"),[{source:"rent",target:"оренда"}]);
  assert.deepEqual(recallTerms(memory,"uk","en","rent"),[]);
  assert.deepEqual(recallTerms(memory,"en","uk","current"),[]);
  const agent=interpreterAgents({memoryEnabled:async()=>false,approvedTerms:()=>assert.fail("memory read")});
  assert.deepEqual(await agent.vocabulary({original:"rent"}),[]);
});
test("research agent rejects invented quotes and links",async()=>{
  const sources=[{label:"Agreement",text:"Rent\nDue on Friday"}];
  const result={findings:[{index:0,quote:"Due on Friday",note:"Matches the written day.",url:"https://example.net"},{index:0,quote:"Due on Monday",note:"Invented"}]};
  const agent=interpreterAgents({retrieve:async()=>sources,model:async()=>result});
  const found=await agent.research({},"en",{documentId:"doc"});
  assert.equal(found.length,1);assert.equal(found[0].line,2);assert.equal(found[0].url,undefined);
  assert.deepEqual(groundedFindings(null,sources),[]);
});
test("correction requires explicit approval and a phrase from the turn",async()=>{
  const requests=[];const agent=interpreterAgents({memoryEnabled:async()=>true,prepareForApproval:async content=>{requests.push(content);return {id:"pending"};}});
  const turn={from:"en",to:"uk",original:"rent is due",translation:""};
  assert.equal(await agent.teach(turn,"income","x"),null);
  assert.equal((await agent.teach(turn,"rent","оренда")).id,"pending");assert.equal(requests.length,1);
});
test("meeting ciphertext requires the invite key and detects changes",async()=>{
  const key=()=>roomKey(base64(crypto.getRandomValues(new Uint8Array(32))));
  const k=await key(), data=await seal(k,{text:"Доброго ранку"});
  assert.deepEqual(await unseal(k,data),{text:"Доброго ранку"});
  await assert.rejects(unseal(await key(),data));
});
