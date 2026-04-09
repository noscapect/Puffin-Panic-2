const fs=require('fs');
const lvl=JSON.parse(fs.readFileSync('levels/level_999.json','utf8'));
const W=400,H=220;
const a=new Uint8Array(W*H);let p=0;for(const [v,c] of lvl.terrain){a.fill(v,p,p+c);p+=c;}
function topYAt(x){for(let y=0;y<H;y++){if(a[y*W+x] && (y===0 || !a[(y-1)*W+x])) return y;} return -1;}
for(const [s,e,label] of [[40,110,'entrance zone'],[160,230,'trench/bridge'],[300,380,'exit ramp']]){
  console.log('--- '+label+' ---');
  let line='';
  for(let x=s;x<=e;x++) line += topYAt(x).toString().padStart(4,' ');
  // too dense, instead print every 2
  let out=[];for(let x=s;x<=e;x+=2) out.push(x+':'+topYAt(x));
  console.log(out.join(' '));
}
