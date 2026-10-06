const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flush = () => new Promise(resolve => setImmediate(resolve));
function load(file, context, require = () => { throw new Error('Unexpected import'); }) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require, console, ...context });
  return exports;
}
function provider({ suspended = false, token } = {}) {
  const timers = new Map(), sockets = [], processors = [], contexts = [];
  let timerId = 0, fetches = 0, stoppedTracks = 0;
  const node = () => ({ connect(){}, disconnect(){} });
  class AudioContext {
    constructor(){ this.state = suspended ? 'suspended' : 'running'; this.sampleRate=48000; this.destination={}; contexts.push(this); }
    async resume(){ this.resumed=true; this.state='running'; }
    async close(){ this.state='closed'; }
    createMediaStreamSource(){return node()}
    createAnalyser(){return {...node(),frequencyBinCount:2,getByteFrequencyData(){}}}
    createGain(){return {...node(),gain:{value:1}}}
    createScriptProcessor(){const p=node();processors.push(p);return p}
  }
  class WebSocket {
    static OPEN=1;
    constructor(url){this.url=url;this.readyState=0;this.sent=[];sockets.push(this)}
    send(bytes){this.sent.push(bytes)}
    close(){this.readyState=3}
  }
  const stt = load('lib/sttProviders.ts', {
    window:{AudioContext}, WebSocket, navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stoppedTracks++}}]})}},
    fetch:async()=>{fetches++;return token ? token : {ok:true,json:async()=>({token:'test-only'})}},
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},
    clearTimeout:id=>timers.delete(id),
  }).DeepgramSttProvider;
  const events=[], finals=[], partials=[];
  const callbacks={onConnecting:()=>events.push('connecting'),onSpeechStart:()=>events.push('ready'),
    onStartupPhase:phase=>events.push(phase),onError:code=>events.push(code),onFinal:text=>finals.push(text),onPartial:text=>partials.push(text)};
  const open = (ws=sockets.at(-1))=>{ws.readyState=1;ws.onopen()};
  const audio=()=>processors.at(-1).onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}});
  const emit=msg=>sockets.at(-1).onmessage({data:JSON.stringify(msg)});
  const run=ms=>{for(const [id,t] of [...timers]) if(t.ms===ms){timers.delete(id);t.fn()}};
  return {stt,callbacks,events,finals,partials,sockets,contexts,timers,open,audio,emit,run,get fetches(){return fetches},get stoppedTracks(){return stoppedTracks}};
}
test('startup resumes suspended audio and signals ready only after first PCM send, without 300ms delay',async()=>{
  const p=provider({suspended:true});await p.stt.start(p.callbacks);
  assert.equal(p.contexts[0].resumed,true);assert.ok(!p.events.includes('ready'));
  assert.ok(![...p.timers.values()].some(t=>t.ms===300));
  p.open();assert.ok(!p.events.includes('ready'));p.audio();
  assert.equal(p.sockets[0].sent.length,1);assert.equal(p.events.at(-1),'ready');
  p.audio();assert.equal(p.events.filter(e=>e==='ready').length,1);
  assert.match(p.sockets[0].url,/model=nova-3&language=multi/);p.stt.stop();
});
test('repeated start during token setup creates one session; stopping aborts late startup',async()=>{
  let resolve;const token=new Promise(r=>resolve=r);const p=provider({token});
  const pending=p.stt.start(p.callbacks);await p.stt.start(p.callbacks);
  assert.equal(p.fetches,1);p.stt.stop();resolve({ok:true,json:async()=>({token:'test-only'})});await pending;
  assert.equal(p.sockets.length,0);assert.ok(!p.events.includes('ready'));
});
test('new speech and interim transcripts cancel turn timeout, preserve final prefix and exact wording',async()=>{
  const p=provider();await p.stt.start(p.callbacks);p.open();p.audio();
  p.emit({is_final:true,channel:{alternatives:[{transcript:'Soy muy bien.',confidence:0.4}]}});
  p.emit({type:'UtteranceEnd'});p.emit({type:'SpeechStarted'});p.run(900);assert.equal(p.finals.length,0);
  p.emit({type:'UtteranceEnd'});p.emit({is_final:false,channel:{alternatives:[{transcript:'y tú'}]}});
  p.run(900);assert.equal(p.finals.length,0);assert.equal(p.partials.at(-1),'Soy muy bien. y tú');
  p.emit({is_final:true,channel:{alternatives:[{transcript:'Y tú?'}]}});
  p.emit({type:'UtteranceEnd'});p.run(900);assert.deepEqual(p.finals,['Soy muy bien. Y tú?']);p.stt.stop();
});
test('stop cancels turn timer and stale callbacks; restart has empty transcript',async()=>{
  const p=provider();await p.stt.start(p.callbacks);p.open();p.audio();
  p.emit({is_final:true,channel:{alternatives:[{transcript:'old'}]}});p.emit({type:'UtteranceEnd'});
  const stale=p.sockets[0].onmessage;p.stt.stop();p.run(900);stale({data:JSON.stringify({type:'UtteranceEnd'})});
  assert.equal(p.finals.length,0);await p.stt.start(p.callbacks);p.open();p.audio();
  p.emit({is_final:true,channel:{alternatives:[{transcript:'new'}]}});p.emit({type:'UtteranceEnd'});p.run(900);
  assert.deepEqual(p.finals,['new']);assert.ok(p.stoppedTracks>=1);p.stt.stop();
});
test('socket close leaves ready state, retries once per error/close pair and cannot retry after stop',async()=>{
  const p=provider();await p.stt.start(p.callbacks);p.open();p.audio();
  const close=p.sockets[0].onclose;p.sockets[0].onerror();close();
  assert.equal(p.events.at(-1),'connecting');p.run(500);await flush();assert.equal(p.sockets.length,2);
  p.open();p.audio();assert.equal(p.events.at(-1),'ready');
  p.sockets[1].onclose();p.stt.stop();p.run(1000);await flush();assert.equal(p.sockets.length,2);
});
test('exhausted reconnection reports error and startup timeout does not claim readiness',async()=>{
  const p=provider();await p.stt.start(p.callbacks);p.run(10000);p.run(500);await flush();
  p.sockets.at(-1).onclose();p.run(1000);await flush();p.sockets.at(-1).onclose();
  assert.equal(p.events.at(-1),'connection-closed');assert.ok(!p.events.includes('ready'));p.stt.stop();
});
test('startup telemetry records elapsed phases without raw audio',()=>{
  let now=1000;const t=load('lib/sttTelemetry.ts',{Date:{now:()=>now}});
  const state=t.createSttTelemetry();t.SttTelemetryOps.requestStartup(state);now=1120;t.SttTelemetryOps.recordStartup(state,'token');
  now=1420;t.SttTelemetryOps.recordStartup(state,'capture');assert.equal(state.startupMs.token,120);assert.equal(state.startupMs.capture,420);
  t.SttTelemetryOps.requestStartup(state);assert.equal(Object.keys(state.startupMs).length,0);
});

test('mic hook guards stale/repeated starts, handles reconnect/end/error, and rejects stopped callbacks',async()=>{
  const slots=[];let cursor=0,callbacks,starts=0;const effects=[];
  const provider={name:'mock',costPerMinute:0,isSupported:()=>true,start(cb){starts++;callbacks=cb},stop(){}};
  const telemetry=load('lib/sttTelemetry.ts',{});
  const finals=[];
  const hook=load('lib/useMic.ts',{window:{},},name=>{
    if(name==='@/lib/sttProviders')return {pickSttProvider:()=>provider};
    if(name==='@/lib/sttTelemetry')return telemetry;
    if(name==='react')return {
      useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i]},
      useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],v=>{slots[i]=v}]},
      useCallback(fn){return fn},useEffect(fn){effects.push(fn)},
    };
    throw new Error(name);
  }).useMic;
  const render=()=>{cursor=0;return hook(text=>finals.push(text))};
  let mic=render();const oldStart=mic.start;await mic.start();await oldStart();
  assert.equal(starts,1);assert.equal(render().state,'connecting');callbacks.onSpeechStart();
  assert.equal(render().state,'listening');await oldStart();assert.equal(starts,1);
  callbacks.onConnecting();assert.equal(render().state,'connecting');callbacks.onSpeechStart();
  callbacks.onEnd();assert.equal(render().state,'idle');await oldStart();assert.equal(starts,2);
  const stale=callbacks;render().stop();stale.onSpeechStart();stale.onFinal('stale');
  assert.equal(render().state,'idle');assert.equal(finals.length,0);
  await oldStart();callbacks.onError('network');callbacks.onEnd();assert.equal(render().state,'error');
});
