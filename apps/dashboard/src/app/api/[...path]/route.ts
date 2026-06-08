import { type NextRequest, NextResponse } from "next/server";

const ENGINE_URL =
  process.env.ENGINE_URL || process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:4000";

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const target = `${ENGINE_URL}/api/${path.join("/")}${req.nextUrl.search}`;

  const isReadMethod = req.method === "GET" || req.method === "HEAD";
  const body = isReadMethod ? undefined : await req.text();

  let res: Response;
  try {
    res = await fetch(target, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Engine unreachable: ${msg}`, code: "ENGINE_UNREACHABLE" },
      { status: 502 },
    );
  }

  const contentType = res.headers.get("Content-Type") ?? "application/json";

  // Pass binary responses (PDF, etc.) through as-is without corrupting them
  if (!contentType.includes("application/json") && !contentType.includes("text/")) {
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: res.status,
      headers: {
        "Content-Type": contentType,
        ...(res.headers.get("Content-Disposition")
          ? { "Content-Disposition": res.headers.get("Content-Disposition")! }
          : {}),
        ...(res.headers.get("Content-Length")
          ? { "Content-Length": res.headers.get("Content-Length")! }
          : {}),
      },
    });
  }

  // JSON / text responses
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": contentType },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
