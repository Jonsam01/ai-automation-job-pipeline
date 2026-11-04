
export function isSameOriginRequest(request) {
    const originHeader = request.headers.get("origin");

    if (!originHeader || originHeader === "null") {
        return false;
    }

    try {
        const origin = new URL(originHeader);
        const requestUrl = new URL(request.url);

        return origin.origin === requestUrl.origin;
    } catch {
        return false;
    }
}
