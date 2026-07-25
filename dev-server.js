"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 4000);
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml" };

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}
loadEnv(path.join(root, ".env.local"));

async function proxy(req, res) {
  try {
    let raw=""; for await (const chunk of req) raw += chunk;
    const configured = process.env.SCORING_UPSTREAM_URL || "https://ielts-gt-writing-hub.vercel.app/api/grade-writing";
    const url = new URL(configured);
    url.pathname = req.url;
    const headers={"Content-Type":"application/json","Accept":"application/json"};
    if (process.env.UPSTREAM_BEARER_TOKEN) headers.Authorization=`Bearer ${process.env.UPSTREAM_BEARER_TOKEN}`;
    const response=await fetch(url,{method:"POST",headers,body:raw});
    res.writeHead(response.status,{"Content-Type":response.headers.get("content-type")||"application/json; charset=utf-8","Cache-Control":"no-store"});
    res.end(await response.text());
  } catch(error){res.writeHead(502,{"Content-Type":"application/json; charset=utf-8"});res.end(JSON.stringify({ok:false,error:"UPSTREAM_PROXY_FAILED",detail:error.message}));}
}

const server=http.createServer(async(req,res)=>{
  if(req.method==="POST"&&req.url.startsWith("/api/")) return proxy(req,res);
  const requestPath=req.url.split("?")[0]==="/"?"/index.html":req.url.split("?")[0];
  const filePath=path.normalize(path.join(root,requestPath));
  if(!filePath.startsWith(root)||!fs.existsSync(filePath)||fs.statSync(filePath).isDirectory()){res.writeHead(404);return res.end("Not found");}
  res.writeHead(200,{"Content-Type":mime[path.extname(filePath)]||"application/octet-stream","Cache-Control":"no-store"});
  fs.createReadStream(filePath).pipe(res);
});
server.listen(port,"127.0.0.1",()=>console.log(`IELTS Writing Studio: http://127.0.0.1:${port}`));
