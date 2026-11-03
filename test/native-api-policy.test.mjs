import test from 'node:test';import assert from 'node:assert/strict';import{apiOrigin,apiPath,apiRequestOptions}from'../mobile/src/lib/api-policy.mjs';
test('native mutations preserve PATCH semantics and reject bodies on GET requests',()=>{
 assert.deepEqual(apiRequestOptions(),{method:'GET'});
 assert.deepEqual(apiRequestOptions({id:'booking'},'PATCH'),{method:'PATCH',body:'{"id":"booking"}',headers:{'Content-Type':'application/json'}});
 assert.equal(apiRequestOptions({action:'save'}).method,'POST');
 assert.throws(()=>apiRequestOptions({},'GET'));
 assert.throws(()=>apiRequestOptions({},'TRACE'));
});
test('native API origins keep session credentials on the configured secure backend',()=>{assert.equal(apiOrigin('https://example.test/'),'https://example.test');assert.equal(apiOrigin('http://10.0.2.2:3500',true),'http://10.0.2.2:3500');for(const url of ['http://example.test','https://user:pass@example.test','https://example.test/path','https://example.test?token=x'])assert.throws(()=>apiOrigin(url,true));assert.throws(()=>apiOrigin('http://127.0.0.1:3500'));for(const path of ['https://evil.test/api/rounds','//evil.test/api/rounds','/api\\evil'])assert.throws(()=>apiPath(path));assert.equal(apiPath('/api/practice?clubId=123'),'/api/practice?clubId=123');});

test('native builds default to the live www domain and local servers require an explicit development override',async()=>{
 const {defaultApiOrigin}=await import('../mobile/src/lib/api-policy.mjs');
 assert.equal(defaultApiOrigin(),'https://www.betterbypar.com');
 assert.equal(defaultApiOrigin('',true),'https://www.betterbypar.com');
 assert.equal(defaultApiOrigin('  ',false),'https://www.betterbypar.com');
 assert.equal(defaultApiOrigin('https://www.betterbypar.com/'),'https://www.betterbypar.com');
 assert.equal(defaultApiOrigin('http://192.168.68.115:3500',true),'http://192.168.68.115:3500');
 assert.throws(()=>defaultApiOrigin('http://192.168.68.115:3500',false));
});

test('native photo uploads preserve multipart bodies and let fetch create the boundary',()=>{
 const form=new FormData();form.set('photo',new Blob(['photo'],{type:'image/jpeg'}),'photo.jpg');
 const options=apiRequestOptions(form);
 assert.equal(options.body,form);
 assert.equal(options.headers,undefined);
 assert.deepEqual(apiRequestOptions({},'DELETE').headers,{'Content-Type':'application/json'});
});
