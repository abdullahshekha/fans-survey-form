import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user) {
    if (pathname === "/login") return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase.from("profiles")
    .select("role, active").eq("id", user.id).single();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=inactive", request.url));
  }

  if (pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL(profile.role === "admin" ? "/admin/overview" : "/dashboard", request.url));
  }
  if (pathname.startsWith("/admin") && profile.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
