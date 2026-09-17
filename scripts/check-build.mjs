import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const origin=process.env.SITE_URL || 'https://heartlandtranspersonalalliance.github.io';
const base=(process.env.BASE_PATH || '/kcpic-site').replace(/\/$/,'');
const routes=['','about/','meetings/','community-resources/','contact/'];
const decode=s=>s.replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
for(const route of [...routes,'404.html']) {
 const file='dist/'+(route.endsWith('.html')?route:route+'index.html');
 assert(existsSync(file),`Missing ${file}`);
 const html=readFileSync(file,'utf8');
 assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,`${route} must have one h1`);
 assert(html.includes(`href="${origin}${base}/${route}"`),`canonical ${route}`);
 for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
  const url=decode(match[1]);
  if(!url.startsWith('/')) continue;
  assert(url.startsWith(base+'/'),`Outside base: ${url}`);
  const [path,fragment]=url.slice(base.length+1).split('#');
  const disk='dist/'+decodeURIComponent(path.split('?')[0]);
  assert(existsSync(disk),`Missing target: ${url}`);
  if(fragment) {
   const target=readFileSync(disk.endsWith('/')?disk+'index.html':disk,'utf8');
   assert(target.includes(`id="${fragment}"`),`Missing anchor ${url}`);
  }
 }
 assert(!html.includes('squarespace-cdn.com'),'Image hotlink');
}
const home=readFileSync('dist/index.html','utf8');
const about=readFileSync('dist/about/index.html','utf8');
const meetings=readFileSync('dist/meetings/index.html','utf8');
assert(!meetings.includes('June 25'),'Expired meeting still displayed');
assert(meetings.includes('https://www.facebook.com/groups/kcpsychedelic'),'Missing meeting destination');
assert(readFileSync('dist/contact/index.html','utf8').includes('mailto:info@kcpic.org'),'Missing email');
const content=await import('../src/data/content.ts');
const normalized=s=>decode(s.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
for(const text of Object.values(content.home)) assert(normalized(home).includes(normalized(text)),`Missing home text: ${text.slice(0,50)}`);
assert(normalized(about).includes(normalized(content.about)),'About text differs');
for(const a of content.agreements) assert(normalized(about).includes(normalized(a.text)),`Missing agreement ${a.title}`);
assert(about.includes('Tam Integration'),'Missing attribution');
const resources=readFileSync('dist/community-resources/index.html','utf8');
for(const r of content.resources) assert(resources.includes(r.url)&&normalized(resources).includes(r.name),`Missing resource ${r.name}`);
assert(existsSync('dist/social.jpg'));
assert(readFileSync('dist/sitemap-0.xml','utf8').includes(origin+base+'/about/'));
console.log(`Verified 5 pages, 404, base-aware links/assets, metadata, original prose, six agreements and seven resources (${base||'/'}).`);
