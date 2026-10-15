import { NextResponse, type NextRequest } from "next/server";

// Fast redirect to sign-in for private areas when no session cookie is present. This is only
// a convenience: every page layout and API route still verifies the session and role.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("vg_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*"],
};
