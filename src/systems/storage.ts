const key=(x:string)=>`mp.${x}`;
export function read<T>(name:string,fallback:T):T{try{const x=localStorage.getItem(key(name));return x?JSON.parse(x) as T:fallback}catch{return fallback}}
export function write(name:string,value:unknown):void{localStorage.setItem(key(name),JSON.stringify(value))}
