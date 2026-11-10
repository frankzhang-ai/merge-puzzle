export class RNG {private s:number; constructor(seed:number){this.s=seed>>>0} next(){this.s=(this.s*1664525+1013904223)>>>0;return this.s/4294967296} int(n:number){return Math.floor(this.next()*n)}}
export function piece(r:RNG, max=2):number[]{const pair=max>=2&&r.next()<0.18;const cap=Math.min(4,max);return Array.from({length:pair?2:1},()=>1+r.int(cap))}
