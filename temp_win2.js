const fs=require('fs');
const lvl=JSON.parse(fs.readFileSync('levels/level_999.json','utf8'));
const W=400,H=220;const a=new Uint8Array(W*H);let p=0;for(const [v,c] of lvl.terrain){a.fill(v,p,p+c);p+=c;}
function printWin(x0,x1,y0,y1){
  console.log(`x ${x0}-${x1}, y ${y0}-${y1}`);
  for(let y=y0;y<=y1;y++){
    let s='';for(let x=x0;x<=x1;x++) s += a[y*W+x]?'#':'.';
    console.log(String(y).padStart(3,'0')+' '+s);
  }
}
printWin(150,240,100,165);
