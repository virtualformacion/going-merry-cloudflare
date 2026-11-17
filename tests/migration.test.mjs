import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseUsers,encode64,decode64} from '../lib/users.js';
import {onRequest as update} from '../functions/api/updateusers.js';
import {onRequest as email} from '../functions/api/getLastEmail.js';
const original=await readFile(new URL('../script.js',import.meta.url),'utf8');
test('GitHub CRUD, Unicode, escaping, auth, duplicates and concurrent commit rejection',async()=>{
 const realFetch=globalThis.fetch;let content=original, writes=0, reject=false;
 globalThis.fetch=async(url,options)=>{
  assert.match(url,/repos\/owner\/repo\/contents\/script.js/);
  if(options.method==='PUT'){
   if(reject)return new Response('conflict',{status:409});
   const body=JSON.parse(options.body);assert.equal(body.sha,'testsha');assert.equal(body.branch,'main');content=decode64(body.content);writes++;
   return Response.json({commit:{sha:'updated'}});
  }
  return Response.json({content:encode64(content),sha:'testsha'});
 };
 const env={GITHUB_TOKEN:'fake',GITHUB_REPO:'owner/repo'};
 const call=async(action,payload,adminPass='merry1212')=>{
 const response=await update({env,request:new Request('https://example.com/api/updateusers',{method:'POST',body:JSON.stringify({action,payload,adminUser:'admin',adminPass})})});return {status:response.status,data:await response.json()};};
 try{
 assert.equal((await call('list',null,'wrong')).status,401);assert.equal(writes,0);
 assert.equal((await call('list')).data.users.length,parseUsers(original).users.length);
 const user={username:'prueba',password:'á=\\"] ; prueba',expiresAt:'2099-01-01',emails:['test+uno@example.com']};
 assert.equal((await call('create',user)).status,200);
 assert.deepEqual(parseUsers(content).users.at(-1),user);
 assert.equal((await call('create',user)).status,409);
 assert.equal((await call('edit',{username:'prueba',newUsername:'prueba2',password:'otra',setEmails:true,emails:[]})).status,200);
 assert.equal(parseUsers(content).users.at(-1).password,'otra');
 reject=true;assert.equal((await call('delete',{username:'prueba2'})).status,500);reject=false;
 assert.equal((await call('delete',{username:'prueba2'})).status,200);
 assert.deepEqual(parseUsers(content).users,parseUsers(original).users);
 assert.equal((await call('anything')).status,400);
 assert.throws(()=>parseUsers('const USERS = [alert("x")];'));
 }finally{globalThis.fetch=realFetch;}
});
test('Gmail refresh, query, multipart Unicode body, no matches and invalid input',async()=>{
 const realFetch=globalThis.fetch;let empty=false;
 globalThis.fetch=async(url,options)=>{
  if(url.includes('oauth2'))return Response.json({access_token:'fake'});
  assert.equal(options.headers.Authorization,'Bearer fake');
  if(url.includes('messages?')){assert.match(decodeURIComponent(url),/to:test@example.com after:/);return Response.json({messages:empty?[]:[{id:'1'}]});}
  return Response.json({internalDate:String(Date.now()),payload:{headers:[{name:'To',value:'test@example.com'},{name:'Subject',value:'Tu código de acceso único para Disney+'}],parts:[{mimeType:'multipart/alternative',parts:[{mimeType:'text/html',body:{data:encode64('<p>Código 123456</p>')}}]}]}});
 };
 const env={GMAIL_CLIENT_ID:'fake',GMAIL_CLIENT_SECRET:'fake',GMAIL_REFRESH_TOKEN:'fake'};
 const call=addr=>email({env,request:new Request('https://example.com/api/getLastEmail',{method:'POST',body:JSON.stringify({email:addr})})});
 try{const result=await call('test@example.com');assert.equal(result.status,200);assert.equal((await result.json()).body,'<p>Código 123456</p>');empty=true;assert.equal((await call('test@example.com')).status,404);assert.equal((await call('bad')).status,400);}finally{globalThis.fetch=realFetch;}
});
