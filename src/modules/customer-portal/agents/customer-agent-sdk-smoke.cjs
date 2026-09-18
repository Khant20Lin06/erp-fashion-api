// Real SDK/provider integration against a local HTTP fixture. No external API key.
// Run from the API root: node src/modules/customer-portal/agents/customer-agent-sdk-smoke.cjs
require('ts-node').register({ transpileOnly: true });
const assert = require('node:assert/strict');
const http = require('node:http');
const { ConfigService } = require('@nestjs/config');
const {
  CustomerAgentModelAdapter,
} = require('./customer-agent-model.adapter.ts');
const {
  CustomerMultiAgentService,
} = require('./customer-multi-agent.service.ts');

async function main() {
  const requests = [];
  let supportScenario = false;
  const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    requests.push(request);
    const step = requests.length;
    let message =
      step === 1
        ? { role: 'assistant', content: JSON.stringify({ route: 'sales' }) }
        : step === 2
          ? {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call-search',
                  type: 'function',
                  function: {
                    name: 'search',
                    arguments: JSON.stringify({ query: 'shirt' }),
                  },
                },
              ],
            }
          : {
              role: 'assistant',
              content: JSON.stringify({ action: 'buy', productId }),
            };
    if (supportScenario) message = step === 1
      ? {role:'assistant',content:JSON.stringify({route:'support'})}
      : step === 2
        ? {role:'assistant',content:null,tool_calls:[{id:'policy-call',type:'function',function:{name:'policy',arguments:'{}'}}]}
        : {role:'assistant',content:JSON.stringify({action:'handoff',text:'Ask shop staff.'})};
    if (message.content) {
      const output = JSON.parse(message.content);
      for (const key of request.response_format?.json_schema?.schema?.required || []) {
        if (!(key in output)) output[key] = null;
      }
      message.content = JSON.stringify(output);
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        id: `fixture-${step}`,
        object: 'chat.completion',
        created: 1,
        model: 'fixture-model',
        choices: [
          {
            index: 0,
            message,
            finish_reason: step === 2 ? 'tool_calls' : 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const config = new ConfigService({
      CUSTOMER_MULTI_AGENT_ENABLED: true,
      CUSTOMER_MULTI_AGENT_PROVIDER: 'openai-compatible',
      CUSTOMER_MULTI_AGENT_MODEL: 'fixture-model',
      AI_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`,
      AI_API_KEY: 'local-fixture-only',
    });
    const service = new CustomerMultiAgentService(
      new CustomerAgentModelAdapter(config),
    );
    const toolCalls = [];
    const result = await service.run(
      { message: 'Show me a shirt' },
      async (name, args) => {
        toolCalls.push({ name, args });
        return { products: [{ id: productId, name: 'Shirt', price: 10 }] };
      },
    );
    assert.equal(result.degraded, false, JSON.stringify(result.trace));
    assert.deepEqual(result.action, { action: 'buy', productId });
    assert.deepEqual(result.trace.agents, ['lead', 'sales']);
    assert.equal(result.trace.modelCalls, 3);
    assert.deepEqual(toolCalls, [{ name: 'search', args: { query: 'shirt' } }]);
    assert.equal(requests.length, 3);
    assert.equal(requests[0].tools?.length || 0, 0);
    assert.deepEqual(requests[1].tools.map((t) => t.function.name).sort(), [
      'detail',
      'popular',
      'search',
    ]);
    assert.ok(
      requests[2].messages.some(
        (m) => m.role === 'tool' && m.content.includes(productId),
      ),
    );
    supportScenario = true;
    requests.length = 0;
    const support = await service.run({message:'What is the return policy?'},async()=>({available:false,policies:[]}));
    assert.equal(support.degraded,false);
    assert.equal(support.action.action,'handoff');
    assert.equal(requests.length,3);
    assert.equal(requests[2].tools?.length || 0,0,'Unavailable data must end tool calls before final output');
    process.stdout.write('customer-agent-sdk-smoke: passed\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
