import test from 'node:test';import assert from 'node:assert/strict';import{apiOrigin,apiPath,apiRequestOptions}from'../mobile/src/lib/api-policy.mjs';
test('native mutations preserve PATCH semantics and reject bodies on GET requests',()=>{
 assert.deepEqual(apiRequestOptions(),{method:'GET'});
 assert.deepEqual(apiRequestOptions({id:'booking'},'PATCH'),{method:'PATCH',body:'{"id":"booking"}'});
 assert.equal(apiRequestOptions({action:'save'}).method,'POST');
 assert.throws(()=>apiRequestOptions({},'GET'));
 assert.throws(()=>apiRequestOptions({},'TRACE'));
});
test('native API origins keep session credentials on the configured secure backend',()=>{assert.equal(apiOrigin('https://example.test/'),'https://example.test');assert.equal(apiOrigin('http://10.0.2.2:3500',true),'http://10.0.2.2:3500');for(const url of ['http://example.test','https://user:pass@example.test','https://example.test/path','https://example.test?token=x'])assert.throws(()=>apiOrigin(url,true));assert.throws(()=>apiOrigin('http://127.0.0.1:3500'));for(const path of ['https://evil.test/api/rounds','//evil.test/api/rounds','/api\\evil'])assert.throws(()=>apiPath(path));assert.equal(apiPath('/api/practice?clubId=123'),'/api/practice?clubId=123');});
