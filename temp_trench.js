const fs=require('fs');const lvl=JSON.parse(fs.readFileSync('levels/level_999.json','utf8'));
const W=400,H=220;const a=new Uint8Array(W*H);let p=0;for(const [v,c] of lvl.terrain){a.fill(v,p,p+c);p+=c;}
for(let y=108;y<=142;y++){
  let s='';for(let x=170;x<=220;x++) s+=a[y*W+x]?'#':'.';
  console.log(String(y).padStart(3,'0')+' '+s);
}
