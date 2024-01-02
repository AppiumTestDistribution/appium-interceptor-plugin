const Proxy = require('http-mitm-proxy').Proxy;
// or using import/module (package.json -> "type": "module")
// import { Proxy } from "http-mitm-proxy";
const proxy = new Proxy();

proxy.onError(function(ctx, err) {
  console.error('proxy error:', err);
});

proxy.onRequest(function(ctx, callback) {
  if (ctx.clientToProxyRequest.headers.host == 'reqres.in') {
  console.log('proxying request for:', ctx.clientToProxyRequest.headers.host);
  const chunks = [];
    ctx.use(Proxy.gunzip);

    /* Replace url */
    if(ctx.proxyToServerRequestOptions?.path) {
      ctx.proxyToServerRequestOptions.path = ctx.proxyToServerRequestOptions.path.replace("page=1", "page=2")
    }

    if(ctx.proxyToServerRequestOptions?.path) {
      ctx.proxyToServerRequestOptions.path = ctx.proxyToServerRequestOptions.path.replace("page=1", "page=2")
    }
  
    /* Replace request body */
    const requestChunks: any = []
    ctx.onRequestData(function(ctx, chunk, callback) {
      // console.log(chunk.toString("utf-8").replace(/Dashboard/g, '<h3>Pwned!</h3>'))
       //chunk = Buffer.from(chunk.toString().replace(/Dashboard/g, '<h3>Pwned!</h3>'));
       requestChunks.push(chunk);
       return callback(null, undefined);
     });

     ctx.onRequestEnd(function(ctx, callback) {
      let bodyOld = Buffer.concat(requestChunks).toString('utf8');
      bodyOld = bodyOld.replace("login=abc", "login=someusername")
      bodyOld = bodyOld.replace("password=123", "password=somepassword")
      ctx.proxyToServerRequest?.write(bodyOld)
      callback();
     });

    ctx.onResponseData(function(ctx, chunk, callback) {
      chunks.push(chunk);
      chunk = Buffer.from(JSON.stringify({"page":1,"per_page":6,"total":12,"total_pages":2,"data":[{"id":1,"email":"saikrishna.bluth@reqres.in","first_name":"George","last_name":"Bluth","avatar":"https://reqres.in/img/faces/1-image.jpg"},{"id":2,"email":"janet.weaver@reqres.in","first_name":"Janet","last_name":"Weaver","avatar":"https://reqres.in/img/faces/2-image.jpg"},{"id":3,"email":"emma.wong@reqres.in","first_name":"Emma","last_name":"Wong","avatar":"https://reqres.in/img/faces/3-image.jpg"},{"id":4,"email":"eve.holt@reqres.in","first_name":"Eve","last_name":"Holt","avatar":"https://reqres.in/img/faces/4-image.jpg"},{"id":5,"email":"charles.morris@reqres.in","first_name":"Charles","last_name":"Morris","avatar":"https://reqres.in/img/faces/5-image.jpg"},{"id":6,"email":"tracey.ramos@reqres.in","first_name":"Tracey","last_name":"Ramos","avatar":"https://reqres.in/img/faces/6-image.jpg"}],"support":{"url":"https://reqres.in/#support-heading","text":"To keep ReqRes free, contributions towards server costs are appreciated!"}}));
      return callback(null, chunk);
    });
    ctx.onResponseEnd(function(ctx, callback) {
     const response = Buffer.concat(chunks).toString('utf8');
     callback(null, null)
    })
  }
  return callback();
});

console.log('begin listening on 8082')
proxy.listen({port: 8084, host: "::"});
