export function stars(moves:number,two:number,three:number):number{return moves>=three?3:moves>=two?2:1}
export function unlocked(best:number[],n:number):boolean{return n===1||best[n-2]!>0}
