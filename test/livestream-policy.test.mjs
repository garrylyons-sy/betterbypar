import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideoId,validateLiveDraft} from '../lib/livestream-policy.mjs';
const id='M7lc1UVf-VE',fixtureId='b8a37066-910f-48ab-a425-e9cd3175430e';
test('accepts YouTube watch, live, short and embed links as one safe video ID',()=>{
 for(const link of [`https://www.youtube.com/watch?v=${id}&t=10`,`https://youtube.com/live/${id}?feature=share`,`https://youtu.be/${id}`,`https://www.youtube.com/embed/${id}`,`https://m.youtube.com/watch?v=${id}`])assert.equal(youtubeVideoId(link),id);
});
test('rejects arbitrary hosts, protocols, credentials, playlists and malformed video IDs',()=>{
 for(const link of [`https://youtube.com.evil.test/watch?v=${id}`,`https://evil.test/${id}`,`javascript:alert(1)`,`http://youtube.com/watch?v=${id}`,`https://evil@youtube.com/watch?v=${id}`,`https://youtube.com/playlist?list=${id}`,`https://youtu.be/short`,`https://youtu.be/${id}/extra`,null,{},''])assert.throws(()=>youtubeVideoId(link),/YouTube/);
});
test('live creation validates fixture identity and ignores client ownership and embed markup',()=>{
 assert.deepEqual(validateLiveDraft({fixtureId,youtubeUrl:`https://youtu.be/${id}`,personId:'spoof',html:'<script>'}),{fixtureId,videoId:id});
 for(const input of [null,[],{fixtureId:'bad',youtubeUrl:`https://youtu.be/${id}`},{fixtureId,youtubeUrl:'bad'}])assert.throws(()=>validateLiveDraft(input));
});
