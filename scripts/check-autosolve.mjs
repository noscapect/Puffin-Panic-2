#!/usr/bin/env node
/** Quick auto-solve check for levels 1 and 5 */
import { readFileSync } from 'fs';
const W=400,H=220,PH=12,FALL_DEATH=70,MAX_STEP=6;
function dec(rle){const d=new Uint8Array(W*H);let i=0;for(const[v,c]of rle)for(let j=0;j<c;j++)d[i++]=v;return d;}
function solid(t,x,y){return x>=0&&x<W&&y>=0&&y<H&&t[y*W+x]!==0;}
function walk(t,sx,sy,dir,ext,ticks=8000){
  let x=sx,y=sy,vx=dir,state='walk',fallY=y,stuckT=0,lx=sx,ly=sy;
  for(let tick=1;tick<=ticks;tick++){
    if(x<0||x>=W||y>H)return {state:'offscreen',x,y};
    const pad=1;
    if(x+8>=ext.x-pad&&x<=ext.x+ext.w+pad&&y+PH>=ext.y-pad&&y<=ext.y+ext.h+pad)
      return {state:'exited',x,y,tick};
    if(state==='fall'){y++;if(solid(t,x|0,(y+PH)|0)){const d=y-fallY;if(d>FALL_DEATH)return{state:'splat',x,y,dist:d};state='walk';}continue;}
    if(!solid(t,x|0,(y+PH+1)|0)){state='fall';fallY=y;continue;}
    if(tick%2===0){
      const nx=(x+vx)|0;
      if(solid(t,nx,(y+PH/2)|0)||solid(t,nx,(y+PH-1)|0)){
        let stepped=false;
        for(let s=1;s<=MAX_STEP;s++){if(!solid(t,nx,(y-s)|0)&&!solid(t,nx,(y-s+PH/2)|0)&&!solid(t,nx,(y-s+PH-1)|0)){x+=vx;y-=s;stepped=true;break;}}
        if(!stepped)vx*=-1;
      }else x+=vx;
    }
    if(tick%50===0){if(Math.abs(x-lx)<2&&Math.abs(y-ly)<2){stuckT+=50;if(stuckT>=300)return{state:'stuck',x:x|0,y:y|0};}else{stuckT=0;lx=x;ly=y;}}
  }
  return {state:'timeout',x:x|0,y:y|0};
}
function findGround(t,ent){let y=ent.y;while(y<H&&!solid(t,ent.x,y+PH))y++;return{x:ent.x,y};}

for(const n of [1,5]){
  const lvl=JSON.parse(readFileSync(`levels/level_00${n}.json`,'utf8'));
  const t=dec(lvl.terrain),e=lvl.entrance,ex=lvl.exit;
  const land=findGround(t,e);
  const r=walk(t,land.x,land.y,1,ex);
  const l=walk(t,land.x,land.y,-1,ex);
  const autosolve=(r.state==='exited'||l.state==='exited');
  console.log(`\nLevel ${n} "${lvl.name}"`);
  console.log(`  skills: builder=${lvl.skills.builder||0} blocker=${lvl.skills.blocker||0}`);
  console.log(`  Landing y=${land.y}  Walk-R: ${r.state} at (${r.x|0},${r.y|0})  Walk-L: ${l.state} at (${l.x|0},${l.y|0})`);
  console.log(autosolve ? '  AUTO-SOLVABLE ← STILL BROKEN' : '  NOT auto-solvable ✔ skills required');
}
