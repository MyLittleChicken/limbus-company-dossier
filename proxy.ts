import { NextResponse, type NextRequest } from 'next/server';
import { DOCUMENT_PATH_HEADER } from './lib/locale';

/** Carry the real document path to the server root layout, including document 404s. */
export function proxy(request: NextRequest) {
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set(DOCUMENT_PATH_HEADER, request.nextUrl.pathname);
	return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
	// Do not exclude arbitrary dotted paths: /en/missing.html is still a document.
	// No public files currently exist; only actual serving namespaces bypass this proxy.
	matcher: ['/((?!media(?:/|$)|_next(?:/|$)).*)'],
};
