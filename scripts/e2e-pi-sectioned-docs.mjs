#!/usr/bin/env node
// E2E_MERIDIAN_ROOT=<built checkout> E2E_PI_CLI=<Pi 0.87.1 cli.js>
// E2E_PLUGIN_PATH=<installed scrub entry> [E2E_EXPECT_LEAK=1] node this-file
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
const meridian = process.env.E2E_MERIDIAN_ROOT
const pi = process.env.E2E_PI_CLI
const plugin = process.env.E2E_PLUGIN_PATH
assert(meridian && pi && plugin, 'Set all three integration paths')
const expectedLeak = process.env.E2E_EXPECT_LEAK === '1'
const version = spawnSync(process.execPath, [pi, '--version'], {encoding:'utf8'})
assert.equal(version.status, 0); assert.equal(version.stdout.trim(), '0.87.1')
const root = mkdtempSync(join(tmpdir(), 'meridian-pi-docs-'))
const config = join(root, 'pi-config'); const project = join(root, 'project')
const proxyConfig = join(root, 'meridian-config'); const plugins = join(root, 'plugins')
for(const dir of [config, project, proxyConfig, plugins]) mkdirSync(dir)
const receipt = `PI-READ-${randomUUID()}`
writeFileSync(join(project, 'receipt.txt'), receipt)
writeFileSync(join(project, 'AGENTS.md'), 'KEEP-PROJECT-CONTEXT: preserve this synthetic project instruction.\n')
const extension = join(root, 'docs-probe.js')
writeFileSync(extension, `export default function(pi) { pi.on('before_agent_start', event => ({systemPrompt: event.systemPrompt.replace('- Additional docs:', '\\n- Additional docs:')})); }`)
for(const key of Object.keys(process.env)) if(key.startsWith('MERIDIAN_') || key.startsWith('CLAUDE_PROXY_')) delete process.env[key]
Object.assign(process.env, {MERIDIAN_CONFIG_DIR:proxyConfig, MERIDIAN_SESSION_DIR:join(root,'proxy-sessions'),MERIDIAN_NO_UPDATE_CHECK:'1',MERIDIAN_CREDENTIALS_READONLY:'1',MERIDIAN_TELEMETRY_PERSIST:'0',MERIDIAN_PASSTHROUGH:'1'})
const before=[];const after=[]
globalThis.__piDocsBefore=before;globalThis.__piDocsAfter=after
const observer = (name, target) => `export default {name:${JSON.stringify(name)}, onRequest(ctx) { const s=ctx.systemContext||''; globalThis.${target}.push({adapter:ctx.adapter,docs:s.includes('<docs>'),closingDocs:s.includes('</docs>'),additionalDocs:s.includes('Additional docs:'),project:s.includes('KEEP-PROJECT-CONTEXT'),readReceipt:JSON.stringify((ctx.messages||[]).filter(m=>m.role==='user'&&Array.isArray(m.content)).flatMap(m=>m.content.filter(b=>b.type==='tool_result'))).includes(${JSON.stringify(receipt)})}); return ctx; }}`
const beforePath=join(root,'before.js'),afterPath=join(root,'after.js')
writeFileSync(beforePath,observer('pi-docs-before','__piDocsBefore'));writeFileSync(afterPath,observer('pi-docs-after','__piDocsAfter'))
const pluginConfigPath=join(root,'plugins.json')
writeFileSync(pluginConfigPath,JSON.stringify({plugins:[{path:beforePath,enabled:true},{path:plugin,enabled:true},{path:afterPath,enabled:true}]}))
const {startProxyServer}=await import(pathToFileURL(join(meridian,'dist/server.js')).href)
let proxy
let continuation = null
async function turn(prompt, label) {
 const env={...process.env,PI_CODING_AGENT_DIR:config,PI_OFFLINE:'1',ANTHROPIC_API_KEY:'local-fixture'}
 for(const key of Object.keys(env)) if(/^(CLAUDE_|OPENAI_|MERIDIAN_|CLAUDE_PROXY_)/.test(key)) delete env[key]
 for(const kind of ['CONFIG','DATA','CACHE','STATE']) env[`XDG_${kind}_HOME`]=join(root,kind.toLowerCase())
 const child=spawn(process.execPath,[pi,'--provider','meridian','--model','claude-opus-5-5','--mode','json','--print','--session',join(root,'session.jsonl'),'--offline','--approve','--no-extensions','--extension',extension,'--no-skills','--no-prompt-templates','--thinking','off','--tools','read',prompt],{cwd:project,env,stdio:['ignore','pipe','pipe']})
 const timeout=setTimeout(()=>child.kill('SIGKILL'),180000)
 let stdout='',stderr='';child.stdout.on('data',c=>{stdout+=c});child.stderr.on('data',c=>{stderr+=c})
 const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});clearTimeout(timeout)
 writeFileSync(join(root,label+'.stdout'),stdout,{mode:0o600});writeFileSync(join(root,label+'.stderr'),stderr,{mode:0o600})
 const events=stdout.split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}})
 return {exit,events:events.length,toolEnds:events.filter(e=>e.type==='tool_execution_end').length,assistantMessages:events.filter(e=>e.type==='message_end'&&e.message?.role==='assistant').length,errors:events.filter(e=>e.message?.stopReason==='error').length}
}
try{
 proxy=await startProxyServer({port:0,host:'127.0.0.1',silent:true,pluginConfigPath,pluginDir:plugins})
 if(!proxy.server.listening)await once(proxy.server,'listening')
 const url=`http://127.0.0.1:${proxy.server.address().port}`
 writeFileSync(join(config,'models.json'),JSON.stringify({providers:{meridian:{baseUrl:url,apiKey:'local-fixture',api:'anthropic-messages',headers:{'x-session-affinity':'pi-docs-'+randomUUID()},models:[{id:'claude-opus-5-5',name:'Opus 5.5',reasoning:false,input:['text'],contextWindow:200000,maxTokens:1024,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}]}}}))
 writeFileSync(join(config,'settings.json'),JSON.stringify({compaction:{enabled:false},retry:{enabled:false}}))
 const first=await turn(`Use read to read ${join(project,'receipt.txt')}, then acknowledge briefly.`, 'first')
 assert(before.some(x=>x.docs&&x.additionalDocs&&x.project),'Actual Pi sectioned prompt never reached Meridian')
 if(expectedLeak){assert(after.some(x=>x.closingDocs&&x.additionalDocs&&x.project),'Published plugin did not reproduce the reported leak')}
 else{
  assert.equal(first.exit,0);assert(first.toolEnds>0);assert.equal(first.errors,0)
  assert(after.length>0&&after.every(x=>!x.docs&&!x.closingDocs&&!x.additionalDocs&&x.project),'Scrub failed or removed project instructions')
  assert(before.some(x=>x.readReceipt),'Real client read receipt never reached SDK boundary')
  const continued=await turn('Give another brief acknowledgement without tools.','continued')
  continuation = continued
  assert.equal(continued.exit,0);assert.equal(continued.errors,0);assert(continued.assistantMessages>0)
 }
 console.log(JSON.stringify({result:'PASS',expectedLeak,pi:version.stdout.trim(),model:'claude-opus-5-5',platform:`${process.platform}/${process.arch}`,first,continuation,before,after,privateArtifacts:root}))
}finally{await proxy?.close()}
