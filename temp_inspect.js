const fs = require('fs');
const lvl = JSON.parse(fs.readFileSync('levels/level_999.json','utf8'));
const W=400,H=220;
const a=new Uint8Array(W*H);
let p=0;
for(const [v,c] of lvl.terrain){a.fill(v,p,p+c);p+=c;}
function segmentsForRow(y){
  const segs=[];
  let inSeg=false,s=0;
  for(let x=0;x<W;x++){
    const solid=a[y*W+x];
    if(solid&&!inSeg){inSeg=true;s=x;}
    if(!solid&&inSeg){segs.push([s,x-1]);inSeg=false;}
  }
  if(inSeg)segs.push([s,W-1]);
  return segs;
}
for(let y=60;y<=150;y+=5){
  const parts=[];
  for(const [x1,x2] of segmentsForRow(y)) parts.push(`${x1}-${x2}(${x2-x1+1})`);
  console.log(`row ${y}: ${parts.join(' | ')}`);
}
