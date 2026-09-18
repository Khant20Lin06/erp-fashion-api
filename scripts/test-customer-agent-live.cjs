// Bounded real-provider checks with synthetic data. Never logs keys or prompts.
require('dotenv').config({ quiet: true });
require('ts-node').register({ transpileOnly: true });
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { CustomerAgentModelAdapter } = require('../src/modules/customer-portal/agents/customer-agent-model.adapter');
const { CustomerMultiAgentService } = require('../src/modules/customer-portal/agents/customer-multi-agent.service');
const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function main() {
  const compatible = process.argv.includes('--provider=openai-compatible');
  const google = !compatible && !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);
  const config = new ConfigService({ ...process.env,
    CUSTOMER_MULTI_AGENT_ENABLED: true,
    CUSTOMER_MULTI_AGENT_PROVIDER: google ? 'google' : 'openai-compatible',
    CUSTOMER_MULTI_AGENT_MODEL: google ? process.env.CUSTOMER_MULTI_AGENT_MODEL : process.env.AI_CHAT_MODEL,
  });
  const adapter = new CustomerAgentModelAdapter(config);
  assert.ok(adapter.configuration(), 'No usable configured provider/model');
  const generate = adapter.generate.bind(adapter);
  adapter.generate = async request => {
    try { return await generate(request); }
    catch (error) {
      let message=String(error?.responseBody||error?.message||'').slice(0,1600);
      for(const key of [process.env.AI_API_KEY,process.env.GOOGLE_GENERATIVE_AI_API_KEY,process.env.GEMINI_API_KEY].filter(Boolean))message=message.split(key).join('[redacted]');
      console.log(JSON.stringify({ event: 'provider-error', agent: request.agent, name: error?.name, status: error?.statusCode, message }));
      throw error;
    }
  };
  const team = new CustomerMultiAgentService(adapter);
  const cases = [
    {name:'burmese-greeting',context:{message:'မင်္ဂလာပါ'},expected:'reply',route:'lead'},
    {name:'explicit-buy-context',context:{message:'ဒီ Wide-Leg Trousers ကို ယူမယ်',recentProducts:[{id:productId,name:'Wide-Leg Trousers'}],latestProductIds:[productId],focusedProductId:productId},expected:'buy',route:'sales'},
    {name:'missing-policy',context:{message:'ဝယ်ပြီးသားပစ္စည်း ပြန်လဲလို့ရလား? ဆိုင်ရဲ့ return policy ကိုပြောပါ'},expected:'handoff',route:'support'},
  ];
  const caseArgument = process.argv.find(value=>value.startsWith('--case='));
  for(const c of cases.filter(value=>!caseArgument||value.name===caseArgument.slice(7))){
    const calls=[];
    const result=await team.run(c.context,async(name,args)=>{
      calls.push(name);
      if(name==='policy')return {available:false,policies:[]};
      if(name==='detail')return {id:productId,name:'Wide-Leg Trousers',currency:'MMK',variants:[]};
      if(name==='search'||name==='popular')return {products:[{id:productId,name:'Wide-Leg Trousers',currency:'MMK',variants:[]}]};
      return {orders:[]};
    });
    console.log(JSON.stringify({case:c.name,degraded:result.degraded,action:result.action?.action,trace:result.trace,tools:calls}));
    assert.equal(result.degraded,false,c.name);
    assert.equal(result.action?.action,c.expected,c.name);
    assert.ok(result.trace.agents.includes(c.route),c.name);
    if(c.name==='burmese-greeting')assert.match(result.action.text,/[\u1000-\u109f]/);
    if(c.name==='explicit-buy-context')assert.equal(result.action.productId,productId);
    if(c.name==='missing-policy')assert.ok(calls.includes('policy'));
  }
  console.log('PASS: real configured provider, synthetic Lead/Sales/Support cases');
}
main().catch(error=>{console.error(JSON.stringify({result:'failed',name:error?.name,code:error?.code||'LIVE_AGENT_CHECK_FAILED'}));process.exitCode=1;});
