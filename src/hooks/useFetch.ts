import { useVersion } from "hooks";

// useFetch wraps the native Deno fetch api and inserts a User-Agent header
export default function useFetch(input: string | URL | Request, init?: RequestInit | undefined): Promise<Response> {
    const requestInit = init ?? {} as RequestInit
    requestInit.headers = { ...requestInit.headers, "User-Agent": `tea.cli/${useVersion()}` }
    return fetch(input,  requestInit)
}
