// Changes only customer-agent switches/model; never reads keys into output.
require('dotenv').config({quiet:true});
const fs = require('node:fs');
const enable = process.argv.includes('--enable');
const modelArgument = process.argv.find(value => value.startsWith('--model='));
const model = modelArgument ? modelArgument.slice(8) : process.env.CUSTOMER_MULTI_AGENT_MODEL || 'gemini-2.5-flash-lite';
if (!/^gemini-[a-zA-Z0-9.-]{1,100}$/.test(model)) throw new Error('Invalid Google model ID');
if (!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY)) throw new Error('Configure a Google key first');
let text = fs.readFileSync('.env', 'utf8');
const values = {CUSTOMER_MULTI_AGENT_PROVIDER:'google',CUSTOMER_MULTI_AGENT_MODEL:model,CUSTOMER_MULTI_AGENT_ENABLED:String(enable)};
for (const [key,value] of Object.entries(values)) {
  const line = key+'='+value;
  const pattern = new RegExp('^'+key+'=.*$', 'm');
  text = pattern.test(text) ? text.replace(pattern,line) : text+'\n'+line+'\n';
}
fs.writeFileSync('.env',text);
console.log(JSON.stringify(values));
