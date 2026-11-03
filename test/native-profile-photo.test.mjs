import test from 'node:test';
import assert from 'node:assert/strict';
import {profilePhotoResize,validateProfilePhotoAsset} from '../mobile/src/lib/profile-photo-policy.mjs';
test('native originals are bounded before decoding and resize without upscaling',()=>{
 assert.deepEqual(profilePhotoResize(4000,3000),{width:1024,height:null});
 assert.deepEqual(profilePhotoResize(3000,4000),{width:null,height:1024});
 assert.equal(profilePhotoResize(400,300),null);
 assert.doesNotThrow(()=>validateProfilePhotoAsset({uri:'file:///photo.heic',width:4000,height:3000,fileSize:5_000_000,type:'image'}));
 for(const asset of [{uri:'',width:1,height:1},{uri:'x',width:0,height:1},{uri:'x',width:10000,height:10000},{uri:'x',width:1,height:1,fileSize:21*1024*1024},{uri:'x',width:1,height:1,type:'video'}])assert.throws(()=>validateProfilePhotoAsset(asset));
});
