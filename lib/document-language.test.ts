import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import 'next/dist/server/node-environment.js';
import testing from 'next/experimental/testing/server.js';
const {unstable_doesMiddlewareMatch}=testing;

test('document locale uses only a supported first path segment, including document 404 paths', async () => {
 const {localeFromPathname}=await import('./locale');
 for(const [path,want] of [['/en','en'],['/en/identities/10616','en'],['/en/missing.html','en'],['/ko/missing.html','ko'],['/en/media/foo','en'],['/%65n/gifts','en'],['/','ko'],['/ja/gifts','ko'],['/english','ko'],['/enough/gifts','ko'],['en/gifts','ko'],['//en/gifts','ko'],['/%ZZ/gifts','ko'],['/en%2Fko/gifts','ko']] as const){
  assert.equal(localeFromPathname(path),want,path);
 }
});

test('proxy includes dotted document and namespace lookalikes while excluding actual asset namespaces', async () => {
 const {config}=await import('../proxy');
 for(const path of ['/','/en/missing.html','/ko/missing.html','/ja/missing.html','/mediafoo','/mediafoo/a.webp','/_nextfoo','/favicon.ico']){
  assert.equal(unstable_doesMiddlewareMatch({config,url:`http://localhost${path}`}),true,path);
 }
 for(const path of ['/media','/media/a.webp','/_next','/_next/static/a.js','/_next/image?url=x']){
  assert.equal(unstable_doesMiddlewareMatch({config,url:`http://localhost${path}`}),false,path);
 }
});

test('proxy overwrites caller language evidence for SSR and preserves unrelated request headers', async () => {
 const {proxy}=await import('../proxy');
 const {DOCUMENT_PATH_HEADER,localeFromPathname}=await import('./locale');
 for(const [path,want] of [['/en/gifts','en'],['/ko/gifts','ko'],['/en/missing.html','en'],['/ja/missing.html','ko'],['/mediafoo','ko'],['/','ko']] as const){
  const request=new NextRequest(`http://localhost${path}`,{headers:{[DOCUMENT_PATH_HEADER]:'/en/spoof','x-test-preserve':'yes'}});
  const response=proxy(request);
  assert.equal(response.headers.get(`x-middleware-request-${DOCUMENT_PATH_HEADER}`),path);
  assert.equal(localeFromPathname(response.headers.get(`x-middleware-request-${DOCUMENT_PATH_HEADER}`)??''),want);
  assert.equal(response.headers.get('x-middleware-request-x-test-preserve'),'yes');
  assert.equal(response.headers.get(DOCUMENT_PATH_HEADER),null);
  assert.equal(response.headers.get('location'),null);
 }
});
