import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/pedir", "/pedido"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Rotas públicas do cliente não precisam consultar o Supabase Auth.
  // Antes, /pedir e /pedido também chamavam Auth em toda requisição,
  // aumentando latência e concorrência de refresh sem qualquer benefício.
  if (isPublic && pathname !== "/login") {
    return NextResponse.next({ request });
  }

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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // O Proxy oficial do Supabase SSR recomenda getClaims(): valida o JWT
  // e evita uma chamada remota a Auth em toda navegação. getUser() aqui
  // causava refreshes concorrentes da mesma sessão e redirecionamentos 307.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // Unauthenticated user accessing protected route → redirect to login
  if (!claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user accessing login → redirect to app
  if (claims && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static (static files)
     *  - _next/image  (image optimisation)
     *  - favicon.ico, sitemap.xml, robots.txt, manifest files
     *  - Public assets
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
