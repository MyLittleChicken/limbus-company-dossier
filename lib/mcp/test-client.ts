import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDossierServer } from './server';

/**
 * 시험 도우미 — 같은 프로세스 안에서 `createDossierServer()` 와 `Client` 를 잇는다.
 *
 * `callTool` 의 outputSchema 검사는 `listTools` 로 받은 스키마를 쓴다. 그래서 여기서 한 번
 * `listTools` 를 불러 둔다 — 시험이 그것을 잊어도 출력 모양 검사가 돈다.
 */
export async function connectInMemory(): Promise<Client> {
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const server = createDossierServer();
	const client = new Client({ name: 'dossier-test', version: '0.0.0' });
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	await client.listTools();
	return client;
}
