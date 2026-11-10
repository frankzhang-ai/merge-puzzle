import test from 'node:test';import assert from 'node:assert/strict';import {emptyBoard,gravity,place,resolve,resolveSteps,cloneBoard,canFit} from '../src/systems/board.ts';
test('gravity compacts flowers',()=>{const b=emptyBoard();b[0]![0]={kind:'flower',level:1};gravity(b);assert.equal(b[8]![0]?.kind,'flower')});
test('three merge, pair and diagonal do not',()=>{const b=emptyBoard();b[8]![0]={kind:'flower',level:1};b[8]![1]={kind:'flower',level:1};b[8]![2]={kind:'flower',level:1};assert.equal(resolve(b,undefined).created[0],2);const c=emptyBoard();c[8]![0]={kind:'flower',level:1};c[8]![1]={kind:'flower',level:1};assert.equal(resolve(c,undefined).chain,0);const d=emptyBoard();d[8]![0]={kind:'flower',level:1};d[7]![1]={kind:'flower',level:1};d[6]![2]={kind:'flower',level:1};assert.equal(resolve(d,undefined).chain,0)});
test('pair requires two empty cells and board fit',()=>{const b=emptyBoard();for(let r=0;r<8;r++)for(let c=0;c<7;c++)b[r]![c]={kind:'stone',hp:1};for(let r=1;r<9;r++)b[r]![0]={kind:'stone',hp:1};assert.equal(place(b,0,[1,1],1),false);assert.equal(canFit(b,[1,1]),false)});
test('column fit checks all seven columns on a nearly full board',()=>{const b=emptyBoard();for(let r=0;r<9;r++)for(let c=0;c<7;c++)b[r]![c]={kind:'stone',hp:1};b[0]![6]=null;b[1]![6]=null;assert.equal(canFit(b,[1,1]),true);b[1]![6]={kind:'stone',hp:1};assert.equal(canFit(b,[1,1]),false)});
test('stone hp and vine blocks group, adjacent merge clears vine',()=>{const b=emptyBoard();b[8]![0]={kind:'flower',level:1};b[8]![1]={kind:'flower',level:1};b[7]![0]={kind:'flower',level:1,vine:true};b[8]![2]={kind:'stone',hp:1};const x=resolve(b,undefined);assert.equal(x.cleared,2);assert.equal(b[8]![0]?.kind,'flower')});
test('level 8 bloom clears and scores',()=>{const b=emptyBoard();for(let c=0;c<3;c++)b[8]![c]={kind:'flower',level:8};const x=resolve(b,undefined);assert.equal(x.score,240);assert.deepEqual(x.created,[8]);assert.equal(b.flat().filter(Boolean).length,0)});

test('resolveSteps plays a two-step chain', () => {
  const board = emptyBoard();
  board[8]![0] = { kind: 'flower', level: 3 };
  board[8]![1] = { kind: 'flower', level: 3 };
  board[8]![2] = { kind: 'flower', level: 2 };
  board[8]![3] = { kind: 'flower', level: 2 };
  board[8]![4] = { kind: 'flower', level: 2 };
  const before = cloneBoard(board);
  const steps = resolveSteps(board);
  assert.ok(steps.length >= 2);
  assert.equal(steps[0]?.created[0], 3);
  assert.equal(steps[1]?.created[0], 4);
  const replay = cloneBoard(before);
  const instant = resolve(replay, undefined);
  assert.equal(instant.chain, steps[steps.length - 1]?.chain);
  assert.equal(instant.score, steps.reduce((n, s) => n + s.score, 0));
});
