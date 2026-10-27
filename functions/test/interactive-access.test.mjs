import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interactiveUntil} from '../src/interactive-access.js';
const stamp=n=>({toMillis:()=>n});
const trial={source:'trial',trialModules:['screens','customerAi'],trialStartedAt:stamp(0),trialEndsAt:stamp(10000)};
test('interactive access defaults to trial but explicit denial and expiry fail closed',()=>{
 assert.equal(interactiveUntil(trial,undefined,1000),10000);
 assert.equal(interactiveUntil(trial,{state:'disabled'},1000),0);
 assert.equal(interactiveUntil(trial,{state:'enabled',expiresAt:stamp(2000)},1000),2000);
 assert.equal(interactiveUntil(trial,{state:'enabled',expiresAt:stamp(2000)},2000),0);
 assert.equal(interactiveUntil(trial,{state:'unknown'},1000),0);
 assert.equal(interactiveUntil({...trial,trialModules:['screens']},undefined,1000),0);
 assert.equal(interactiveUntil({...trial,trialModules:['screens']},{state:'enabled',expiresAt:stamp(20000)},1000),10000);
 assert.equal(interactiveUntil(trial,{state:'enabled',expiresAt:stamp(20000)},10000),0);
 assert.equal(interactiveUntil({...trial,trialModules:['customerAi']},{state:'enabled',expiresAt:stamp(20000)},1000),0);
});
