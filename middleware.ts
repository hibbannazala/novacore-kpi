import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Old routes that should redirect to correct routes
const OLD_ROUTE_REDIRECTS: Record<string, string> = {
  "/absensi/staff":    "/absensi/home",
  "/absensi/checkin":  "/absensi/home",
  "/absensi/check-in": "/absensi/home",
  "/absensi/presensi": "/absensi/home",
  "/absensi/user":     "/absensi/home",
  "/absensi/karyawan": "/absensi/home",
};

// Admin/privileged routes - skip time-based redirect for these
const PRIVILEGED_PREFIXES = [
  "/absensi/admin",
  "/dashboard/head",
  "/dashboard/hr",
  "/dashboard/executive",
  "/dashboard/developer",
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must not write any logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ─ Redirect old/broken routes ───────────────────────────────────────────────
  if (OLD_ROUTE_REDIRECTS[pathname]) {
    const url = request.nextUrl.clone();
    url.pathname = OLD_ROUTE_REDIRECTS[pathname];
    return NextResponse.redirect(url);
  }

  // Redirect unauthenticated users to login
  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/absensi"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ─ Time-based check-in redirect (06:00–09:00 WIB = UTC+7) ──────────────────
  // Only for authenticated users accessing non-admin, non-absensi routes
  if (user) {
    const nowUTC = new Date();
    const wibHour = (nowUTC.getUTCHours() + 7) % 24; // convert UTC to WIB

    const isCheckinTime = wibHour >= 6 && wibHour < 9;
    const isAbsensiPage = pathname.startsWith("/absensi");
    const isPrivileged = PRIVILEGED_PREFIXES.some((p) => pathname.startsWith(p));

    if (isCheckinTime && !isAbsensiPage && !isPrivileged) {
      const url = request.nextUrl.clone();
      url.pathname = "/absensi/home";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

